/**
 * Comprueba lo que de verdad importa en La Restinga: que la guía abra sin red.
 *
 * Carga la página, espera a que el service worker tome el control, corta la
 * conexión y recarga. Si las fichas siguen pintando, la PWA sirve.
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

/* Primera visita: con red. */
await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
const controlled = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return false;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  return !!navigator.serviceWorker.controller;
});
console.log(`service worker al mando: ${controlled ? "sí" : "NO"}`);

/* Navegar una vez más con red, para que el SW cachee alguna foto. */
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1200));

/* Ahora, sin red. */
const cdp = await page.target().createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1
});

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => {
  errors.push("recarga sin red: " + e.message);
});
await new Promise((r) => setTimeout(r, 1800));

const offline = await page.evaluate(() => ({
  cards: document.querySelectorAll("#grid .card").length,
  stat: (document.querySelector("#statLine") || {}).textContent || "",
  fotos: [...document.querySelectorAll("#grid img.shot")].filter((i) => i.naturalWidth > 0).length,
  imgs: document.querySelectorAll("#grid img.shot").length,
  travel: document.querySelectorAll("#travelList .travel-row").length,
  dives: document.querySelectorAll("#diveList .dive-item").length
}));

console.log(`sin red · fichas ${offline.cards} · fotos cargadas ${offline.fotos}/${offline.imgs}`);
console.log(`sin red · viaje ${offline.travel} filas · inmersiones ${offline.dives}`);
console.log(`sin red · contador "${offline.stat.trim().slice(0, 60)}"`);

const ok = controlled && offline.cards > 0 && offline.travel > 0 && offline.dives > 0;
console.log(ok ? "\nLa guía funciona sin conexión." : "\nFALLA sin conexión.");
if (errors.length) for (const e of [...new Set(errors)]) console.log("  " + e);

await browser.close();
process.exit(ok ? 0 : 1);
