/**
 * Marks the species worth reporting to REDPROMAR, and renders the brand assets
 * (favicon, PWA icons, Open Graph card) from Agustín's logo.
 *
 * PNGs are rasterised with the same headless Chrome used to verify the site, so
 * the repo carries no image toolchain.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const PUB = join(ROOT, "public");
const CHROME = process.env.CHROME_PATH
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

/* ── 1. Bandera de reporte ────────────────────────────────────────────── */

/* Protegidas, amenazadas, reguladas o sensibles: una cita suya tiene valor real
   para la red de observadores. Se suma cualquier especie de presencia no
   confirmada, porque confirmarla es justo lo que falta. */
const SENSIBLES = new Set([
  26,   // Physalia physalis, relevante para avisos costeros
  57,   // Charonia lampas, protegida
  60, 61, // marisqueo regulado y endemismo mermado
  77,   // Diadema africanum, mortandades masivas
  86,   // Ophidiaster ophidianus
  96, 97, // Mycteroperca fusca, Epinephelus marginatus
  107, 108, 109, 110, // tiburones
  113, 114,           // batoideos
  115, 116,           // tortugas
  117, 118, 119, 120  // cetáceos
]);

/* El fichero es {especies:[...]} para que Sveltia lo mapee a un formulario;
   se acepta el array suelto por compatibilidad con volcados antiguos. */
const rawSpecies = JSON.parse(readFileSync(join(PUB, "data", "species.json"), "utf8"));
const species = Array.isArray(rawSpecies) ? rawSpecies : rawSpecies.especies;
let flagged = 0;
for (const sp of species) {
  const marcar = SENSIBLES.has(sp.i) || sp.loc !== "si";
  if (marcar) { sp.rp = true; flagged++; } else { delete sp.rp; }
}
writeFileSync(join(PUB, "data", "species.json"), JSON.stringify({ especies: species }, null, 1) + "\n", "utf8");
console.log(`marcadas para REDPROMAR: ${flagged}/${species.length}`);

/* ── 2. Marca ─────────────────────────────────────────────────────────── */

const logo = readFileSync(join(ROOT, "artifact", "logo-mark.svg"), "utf8");
const inner = logo.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

/* Favicon: la máscara sobre el azul de marca, cuadrado, sin márgenes muertos. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="42" fill="#061418"/>
<g transform="translate(0,26)">${inner}</g>
</svg>
`;
writeFileSync(join(PUB, "favicon.svg"), favicon, "utf8");

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();

async function shot(html, w, h, file, type = "png") {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>*{margin:0;padding:0}html,body{width:${w}px;height:${h}px;overflow:hidden}</style>
    ${html}`, { waitUntil: "load" });
  const buf = await page.screenshot({ type, quality: type === "jpeg" ? 86 : undefined });
  writeFileSync(join(PUB, file), buf);
  console.log(`  ${file} · ${w}×${h} · ${(buf.length / 1024).toFixed(0)} KB`);
}

const iconHtml = (size) => `<div style="width:${size}px;height:${size}px;background:#061418;
  display:flex;align-items:center;justify-content:center">
  <svg viewBox="0 0 200 150" width="${Math.round(size * 0.76)}">${inner}</svg></div>`;

await shot(iconHtml(192), 192, 192, "icon-192.png");
await shot(iconHtml(512), 512, 512, "icon-512.png");
await shot(iconHtml(180), 180, 180, "icon-180.png");

/* Open Graph: lo que se ve cuando alguien comparte el enlace por WhatsApp. */
const hero = readFileSync(join(PUB, "fotos", "hero.webp")).toString("base64");
const og = `<div style="width:1200px;height:630px;position:relative;overflow:hidden;
  font-family:Georgia,serif;background:#061418;color:#eaf6f7">
  <img src="data:image/webp;base64,${hero}" style="position:absolute;inset:0;width:100%;height:100%;
    object-fit:cover;opacity:.42">
  <div style="position:absolute;inset:0;background:linear-gradient(105deg,#061418 22%,rgba(6,20,24,.55) 72%)"></div>
  <div style="position:absolute;left:74px;top:74px;bottom:74px;right:74px;display:flex;
    flex-direction:column;justify-content:space-between">
    <svg viewBox="0 0 200 150" width="150">${inner}</svg>
    <div>
      <p style="font:700 19px ui-sans-serif,Segoe UI,sans-serif;letter-spacing:.17em;
        color:#2fd4c0;margin-bottom:18px">RESERVA MARINA · MAR DE LAS CALMAS · EL HIERRO</p>
      <h1 style="font-size:70px;font-weight:600;line-height:1.05;letter-spacing:-.02em">
        Lo que vive <i>bajo</i> las calmas</h1>
      <p style="font:26px ui-sans-serif,Segoe UI,sans-serif;color:#8fb3ba;margin-top:22px">
        120 especies · taxonomía verificada · Agustín Fragero Blesa, Dive Master</p>
    </div>
  </div>
</div>`;
await shot(og, 1200, 630, "og.jpg", "jpeg");

await browser.close();
