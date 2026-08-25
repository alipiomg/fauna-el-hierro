/**
 * ONE-SHOT. Turns the prototype artefact into public/index.html.
 *
 * From here on public/index.html is the source of truth and is edited by hand;
 * the artefact stays frozen in artifact/ as the reference prototype.
 * Re-running this would discard every later edit, so it refuses to overwrite.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "artifact", "fauna-el-hierro.html");
const DEST = join(ROOT, "public", "index.html");

if (existsSync(DEST) && !process.argv.includes("--force")) {
  console.error("public/index.html ya existe. Es fuente editada a mano: no lo piso.");
  process.exit(1);
}

const lines = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n").split("\n");
const styleEnd = lines.findIndex((l) => l.trim() === "</style>");
if (styleEnd < 0) throw new Error("no encuentro </style>");

const css = lines.slice(2, styleEnd + 1).join("\n"); // <style> .. </style>
let body = lines.slice(styleEnd + 1).join("\n");

/* ── Payload out, loader in ───────────────────────────────────────────── */

function drop(name, open, close, replacement) {
  const start = body.indexOf(`const ${name} = ${open}`);
  if (start < 0) throw new Error(`no encuentro const ${name}`);
  const from = start + `const ${name} = `.length;
  let depth = 0, inStr = false, quote = "", esc = false, end = -1;
  for (let k = from; k < body.length; k++) {
    const c = body[k];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end < 0) throw new Error(`literal ${name} sin cerrar`);
  const tail = body.slice(end).match(/^;?/)[0];
  body = body.slice(0, start) + replacement + body.slice(end + tail.length);
}

drop("SPECIES", "[", "]", "let SPECIES = [];");
drop("PHOTOS", "{", "}", "let PHOTOS = {};");

/* ── data URI -> file path ────────────────────────────────────────────── */

const heroRe = /(<img class="hero-shot" src=")data:[^"]+(")/;
if (!heroRe.test(body)) throw new Error("no encuentro la foto del hero");
body = body.replace(heroRe, '$1fotos/hero.webp" width="1500" height="1125" fetchpriority="high$2');

const before = body.split("ph.d").length - 1;
body = body.split("'+ph.d+'").join("'+photoSrc(ph)+'").split("' + ph.d + '").join("' + photoSrc(ph) + '");
const after = body.split("ph.d").length - 1;
console.log(`data URI en render sustituidas: ${before - after} (quedan ${after})`);
if (after !== 0) throw new Error("queda alguna ph.d sin sustituir");

/* ── Async boot ───────────────────────────────────────────────────────── */

const BOOT_OLD = `buildControls();
renderIsland();
renderCredits();
renderStats();
render();`;
if (!body.includes(BOOT_OLD)) throw new Error("no encuentro la secuencia de arranque");

const BOOT_NEW = `const photoSrc = ph => "fotos/" + ph.f;

async function boot(){
  try{
    const [species, photos] = await Promise.all([
      fetch("data/species.json").then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("data/photos.json").then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    ]);
    SPECIES = species;
    PHOTOS  = photos;
  }catch(err){
    $("#grid").innerHTML = '<p class="empty">No se han podido cargar los datos de la gu&iacute;a. '
      + 'Comprueba la conexi&oacute;n y recarga la p&aacute;gina.</p>';
    console.error(err);
    return;
  }
  buildControls();
  renderIsland();
  renderCredits();
  renderStats();
  render();
}

boot();`;

body = body.replace(BOOT_OLD, BOOT_NEW);

/* photoSrc is declared with the boot block at the end of the script, but
   media() runs later than parse time, so a const at the bottom is fine. */

const HEAD = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fauna Marina de El Hierro — gu&iacute;a de buceo del Mar de las Calmas</title>
<meta name="description" content="Gu&iacute;a de identificaci&oacute;n de 120 especies del Mar de las Calmas, El Hierro. Taxonom&iacute;a verificada en WoRMS y fotograf&iacute;a con licencia. Por Agust&iacute;n Fragero Blesa, Dive Master en La Restinga.">
<meta name="author" content="Agust&iacute;n Fragero Blesa">
<meta name="theme-color" content="#061418">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preload" as="image" href="fotos/hero.webp" fetchpriority="high">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="Fauna Marina de El Hierro">
<meta property="og:title" content="Fauna Marina de El Hierro — gu&iacute;a de buceo del Mar de las Calmas">
<meta property="og:description" content="120 especies del Mar de las Calmas con taxonom&iacute;a verificada y fotograf&iacute;a con licencia. Por Agust&iacute;n Fragero Blesa, Dive Master en La Restinga.">
<meta property="og:image" content="og.jpg">
<meta name="twitter:card" content="summary_large_image">
${css}
</head>
<body>`;

writeFileSync(DEST, HEAD + body.replace(/\s*$/, "") + "\n</body>\n</html>\n", "utf8");
console.log(`escrito ${DEST}`);
