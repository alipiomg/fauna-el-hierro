/**
 * Real-browser check of a deployment. Not a unit test: it loads the page like a
 * diver on mobile data would, and reports what actually arrived.
 *
 *   node scripts/verify.mjs http://127.0.0.1:8899/
 *   node scripts/verify.mjs https://<dominio>/
 */
import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://127.0.0.1:8899/";
const CHROME = process.env.CHROME_PATH
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const errors = [];
const requests = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()} — ${r.failure()?.errorText}`));
page.on("response", async (r) => {
  const h = r.headers();
  /* Content-Length falta en algunos servidores; entonces se pesa el cuerpo. */
  let bytes = Number(h["content-length"] || 0);
  if (!bytes) bytes = await r.buffer().then((b) => b.length).catch(() => 0);
  requests.push({
    url: r.url(),
    status: r.status(),
    type: r.request().resourceType(),
    bytes,
    cache: h["cache-control"] || ""
  });
});

const t0 = Date.now();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
const loadMs = Date.now() - t0;

/* Wait for the grid to actually paint species, not just for the HTML. */
await page.waitForFunction(() => document.querySelectorAll("#grid .card").length > 0, { timeout: 20000 })
  .catch(() => errors.push("el listado de especies no ha pintado ninguna ficha"));

/* The page script runs in strict mode, so its state is not on window. Read the
   same JSON the page reads instead of poking at internals. */
const facts = await page.evaluate(async () => {
  const j = (f) => fetch("data/" + f).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [species, photos, dives, isla] = await Promise.all(
    ["species.json", "photos.json", "inmersiones.json", "isla.json"].map(j)
  );
  const s = species || [];
  const n = (k) => s.filter((x) => x[k]).length;
  return {
    title: document.title,
    species: s.length,
    photos: Object.keys(photos || {}).length,
    cards: document.querySelectorAll("#grid .card").length,
    sections: [...document.querySelectorAll("main > section[id]")].map((x) => x.id),
    logoHeader: !!document.querySelector(".topbar .brand-mark svg use"),
    logoFooter: !!document.querySelector(".foot .foot-mark use"),
    filled: { food: n("food"), repro: n("repro"), def: n("def"), eco: n("eco"), risk: n("risk"), rp: n("rp") },
    travelRows: document.querySelectorAll("#travelList .travel-row").length,
    author: !!document.querySelector("#authorCard .author-actions a"),
    divePins: document.querySelectorAll("#diveMap .dive-pin").length,
    diveItems: document.querySelectorAll("#diveList .dive-item").length,
    coast: !!(isla || {}).costa,
    dives: ((dives || {}).puntos || []).length
  };
});

/* Open the sheet of a species that has all four new blocks plus a hazard note,
   which is the case that has to work: Diadema africanum. */
const sheet = await page.evaluate(async () => {
  const q = document.querySelector("#q");
  q.value = "Diadema";
  q.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  const btn = document.querySelector("#grid [data-open]");
  if (!btn) return null;
  btn.click();
  await new Promise((r) => setTimeout(r, 250));
  return {
    open: document.querySelector("#modal")?.dataset.open === "true",
    name: document.querySelector("#mName")?.textContent,
    blocks: [...document.querySelectorAll("#mRight .box h3")].map((h) => h.textContent.trim()),
    risk: !!document.querySelector("#mRight .box--risk"),
    plateBtn: !!document.querySelector("[data-plate]"),
    reportBtn: !!document.querySelector("[data-report]"),
    mapPins: document.querySelectorAll("#mRight .mapBox svg circle").length,
    photo: document.querySelector("#mLeft img.shot")?.getAttribute("src") || null
  };
});

/* La lámina imprimible: se pulsa el botón y se comprueba que el navegador
   recibe de verdad un PNG, no que la función exista. */
const plate = await (async () => {
  const { readdirSync, statSync, mkdirSync, readFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), ".work", "descargas");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  /* Sesión CDP a nivel de navegador, no de pestaña: con la de pestaña Chrome
     transfiere el fichero entero y luego cancela la escritura. */
  const cdp = await browser.target().createCDPSession();
  let name = null;
  cdp.on("Browser.downloadWillBegin", (e) => { name = e.suggestedFilename; });
  const finished = new Promise((res) => {
    cdp.on("Browser.downloadProgress", (e) => { if (e.state !== "inProgress") res(e.state); });
    setTimeout(() => res("timeout"), 90000);
  });
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allowAndName", downloadPath: dir, eventsEnabled: true
  });

  /* El botón vive dentro del panel desplazable de la ficha, muy por debajo del
     viewport: se pulsa por JS y no por coordenadas. */
  await page.$eval("[data-plate]", (el) => el.click()).catch(() => {});
  const state = await finished;
  if (state !== "completed") return null;

  const files = readdirSync(dir);
  if (!files.length) return null;
  const f = join(dir, files[0]);
  const buf = readFileSync(f);
  /* Cabecera PNG y dimensiones del chunk IHDR: que sea una imagen de verdad y
     del tamaño prometido, no un fichero cualquiera con la extensión puesta. */
  const isPng = buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return {
    file: name || files[0],
    bytes: statSync(f).size,
    png: isPng,
    w: isPng ? buf.readUInt32BE(16) : 0,
    h: isPng ? buf.readUInt32BE(20) : 0
  };
})();

const firstLoad = requests
  .filter((r) => r.status < 400 && ["document", "script", "stylesheet", "fetch", "xhr", "image", "font"].includes(r.type))
  .reduce((a, r) => a + r.bytes, 0);

const byType = {};
for (const r of requests) {
  if (r.status >= 400) continue;
  byType[r.type] = (byType[r.type] || 0) + r.bytes;
}

const kb = (n) => (n / 1024).toFixed(0) + " KB";

console.log("\n" + URL);
console.log("─".repeat(64));
console.log(`title      ${facts.title}`);
console.log(`carga      ${loadMs} ms hasta networkidle2`);
console.log(`peso 1ª    ${kb(firstLoad)} en ${requests.filter(r => r.status < 400).length} peticiones`);
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${t.padEnd(11)}${kb(n)}`);
}
console.log(`especies   ${facts.species} · fotos ${facts.photos} · fichas pintadas ${facts.cards}`);
console.log(`campos     food ${facts.filled.food} · repro ${facts.filled.repro} · def ${facts.filled.def} · eco ${facts.filled.eco} · risk ${facts.filled.risk}`);
console.log(`secciones  ${facts.sections.join(" ")}`);
console.log(`logotipo   cabecera ${facts.logoHeader ? "sí" : "NO"} · pie ${facts.logoFooter ? "sí" : "NO"}`);
console.log(`viaje      ${facts.travelRows} conexiones · autor ${facts.author ? "sí" : "NO"}`);
console.log(`inmersión  ${facts.diveItems}/${facts.dives} fichas · ${facts.divePins} pines · costa ${facts.coast ? "real" : "NO"}`);
console.log(`REDPROMAR  ${facts.filled.rp} especies marcadas`);
if (sheet) {
  console.log(`ficha      ${sheet.open ? "abre" : "NO ABRE"} — ${sheet.name}`);
  console.log(`  bloques  ${sheet.blocks.join(" · ")}`);
  console.log(`  riesgo   ${sheet.risk ? "sí" : "no"} · lámina ${sheet.plateBtn ? "sí" : "NO"} · REDPROMAR ${sheet.reportBtn ? "sí" : "no"}`);
  console.log(`  mapa     ${sheet.mapPins} puntos`);
  console.log(`  foto     ${sheet.photo ? sheet.photo.slice(0, 60) : "lámina generada"}`);
} else {
  console.log("ficha      NO SE HA PODIDO ABRIR");
}
console.log(plate
  ? `lámina     ${plate.file} · ${plate.w}×${plate.h} px · ${(plate.bytes / 1048576).toFixed(1)} MB · ${plate.png ? "PNG válido" : "NO ES PNG"}`
  : "lámina     NO SE HA DESCARGADO");

const notFound = requests.filter((r) => r.status >= 400);
if (notFound.length) {
  console.log(`\n${notFound.length} respuestas con error:`);
  for (const r of notFound.slice(0, 12)) console.log(`   ${r.status} ${r.url}`);
}

if (errors.length) {
  console.log(`\n${errors.length} errores en consola:`);
  for (const e of [...new Set(errors)].slice(0, 12)) console.log("   " + e);
} else {
  console.log("\nsin errores de consola");
}

await browser.close();
process.exit(errors.length || notFound.length || !plate || !plate.png || plate.w !== 3072 ? 1 : 0);
