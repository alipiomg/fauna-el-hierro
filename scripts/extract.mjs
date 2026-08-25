/**
 * Extracts the self-contained prototype into a publishable static site.
 *
 *   artifact/fauna-el-hierro.html   (4.4 MB, base64 inline)
 *        -> public/index.html       (template, no payload)
 *        -> public/data/species.json
 *        -> public/data/photos.json (credits only, no pixels)
 *        -> public/fotos/*.webp     (one file per photo)
 *
 * The prototype stays untouched as the reference artefact.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "artifact", "fauna-el-hierro.html");
const OUT = join(ROOT, "public");

const html = readFileSync(SRC, "utf8");

/* ── 1. Evaluate the two JS literals in a throwaway scope ─────────────── */

function literal(name, open, close) {
  const start = html.indexOf(`const ${name} = ${open}`);
  if (start < 0) throw new Error(`no encuentro const ${name}`);
  const from = start + `const ${name} = `.length;
  // Balanced scan that ignores brackets inside string literals.
  let depth = 0, inStr = false, quote = "", esc = false;
  for (let k = from; k < html.length; k++) {
    const c = html[k];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return html.slice(from, k + 1); }
  }
  throw new Error(`literal ${name} sin cerrar`);
}

const SPECIES = new Function(`return ${literal("SPECIES", "[", "]")}`)();
const PHOTOS = new Function(`return ${literal("PHOTOS", "{", "}")}`)();

console.log(`especies: ${SPECIES.length}`);
console.log(`fotos:    ${Object.keys(PHOTOS).length}`);

/* ── 2. Photos: data URI -> file on disk, credits -> JSON ─────────────── */

mkdirSync(join(OUT, "fotos"), { recursive: true });
mkdirSync(join(OUT, "data"), { recursive: true });

const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" };

function dump(key, dataUri, basename) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUri);
  if (!m) throw new Error(`data URI ilegible en ${key}`);
  const ext = EXT[m[1]];
  if (!ext) throw new Error(`tipo no soportado ${m[1]} en ${key}`);
  const buf = Buffer.from(m[2], "base64");
  const file = `${basename}.${ext}`;
  writeFileSync(join(OUT, "fotos", file), buf);
  return { file, bytes: buf.length };
}

const photos = {};
let bytes = 0;
for (const [key, p] of Object.entries(PHOTOS)) {
  const { file, bytes: n } = dump(key, p.d, key);
  bytes += n;
  photos[key] = { f: file, a: p.a, l: p.l, u: p.u };
}

/* The hero shot lives in the markup, not in PHOTOS. */
const heroRe = /<img class="hero-shot" src="(data:[^"]+)"/;
const hero = heroRe.exec(html);
if (!hero) throw new Error("no encuentro la foto del hero");
const heroOut = dump("hero", hero[1], "hero-mar-de-las-calmas");
bytes += heroOut.bytes;

console.log(`ficheros de imagen: ${Object.keys(photos).length + 1} · ${(bytes / 1048576).toFixed(2)} MB`);

writeFileSync(join(OUT, "data", "photos.json"), JSON.stringify(photos, null, 1) + "\n", "utf8");
writeFileSync(join(OUT, "data", "species.json"), JSON.stringify(SPECIES, null, 1) + "\n", "utf8");

/* ── 3. Report the shape of the data so the content pass knows the gaps ─ */

const keys = new Set();
for (const s of SPECIES) for (const k of Object.keys(s)) keys.add(k);
console.log("campos presentes:", [...keys].join(" "));

const missing = (k) => SPECIES.filter((s) => !s[k]).length;
for (const k of ["food", "repro", "def", "eco", "dist", "risk"]) {
  console.log(`  sin ${k}: ${missing(k)}/${SPECIES.length}`);
}

const noPhoto = SPECIES.filter((s) => !photos["s" + s.i]).map((s) => `${s.i} ${s.s}`);
console.log(`sin fotografia (${noPhoto.length}):`, noPhoto.join(" · "));

const dudosa = SPECIES.filter((s) => s.loc === "dudosa").length;
const ausente = SPECIES.filter((s) => s.loc === "no").length;
console.log(`presencia dudosa: ${dudosa} · presencia no: ${ausente}`);
