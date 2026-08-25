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
  requests.push({
    url: r.url(),
    status: r.status(),
    type: r.request().resourceType(),
    bytes: Number(h["content-length"] || 0),
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
process.exit(errors.length || notFound.length ? 1 : 0);
