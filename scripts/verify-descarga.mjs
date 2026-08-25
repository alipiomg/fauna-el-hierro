/**
 * Comprueba la descarga completa para uso sin conexión: pulsa el botón, espera
 * a que el service worker guarde las 128 fotografías, corta la red y confirma
 * que las fichas siguen saliendo CON foto.
 *
 * Es el caso real: wifi en el muelle, luego nada.
 */
import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://127.0.0.1:8899/";
const CHROME = process.env.CHROME_PATH
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
});

const before = await page.$eval("#offlineState", (el) => el.textContent.trim());
console.log(`estado inicial · ${before}`);

const t0 = Date.now();
await page.click("#offlineBtn");
await page.waitForFunction(
  () => document.querySelector("#offlineBtn")?.disabled
     && /descargada|no se han podido|tardado/i.test(document.querySelector("#offlineState")?.textContent || ""),
  { timeout: 180000, polling: 500 }
).catch(() => {});
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const after = await page.$eval("#offlineState", (el) => el.textContent.trim());
console.log(`tras descargar · ${after} (${secs} s)`);

const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  let n = 0;
  for (const k of names.filter((k) => k.includes("fotos"))) {
    n += (await (await caches.open(k)).keys()).length;
  }
  return n;
});
console.log(`en caché · ${cached} fotografías`);

/* Cortar la red y recargar. */
const cdp = await page.target().createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1
});
await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));

/* No se comprueba por scroll: loading="lazy" no se dispara de forma fiable con
   desplazamiento programatico en headless, y eso mediria el navegador de
   pruebas, no la guia. Se pide cada fotografia directamente y se comprueba que
   llega sin red, que es lo que hara el movil al abrir una ficha. */
const offline = await page.evaluate(async () => {
  const photos = await fetch("data/photos.json").then((r) => r.json());
  const urls = Object.values(photos).map((p) => "fotos/" + p.f);
  let ok = 0, fail = 0;
  for (let i = 0; i < urls.length; i += 12) {
    const res = await Promise.all(urls.slice(i, i + 12).map((u) =>
      fetch(u).then((r) => r.ok).catch(() => false)
    ));
    for (const r of res) r ? ok++ : fail++;
  }
  const species = await fetch("data/species.json").then((r) => r.json()).catch(() => []);
  return {
    cards: document.querySelectorAll("#grid .card").length,
    imgs: urls.length,
    ok,
    fail,
    species: species.length
  };
});

console.log(`sin red · ${offline.cards} fichas pintadas · ${offline.species} especies en datos`);
console.log(`sin red · fotografías servidas desde caché ${offline.ok}/${offline.imgs}`);

const pass = cached >= 120 && offline.cards > 0 && offline.species === 120 && offline.fail === 0;
console.log(pass ? "\nDescarga y uso sin conexión: correctos." : "\nFALLA.");

await browser.close();
process.exit(pass ? 0 : 1);
