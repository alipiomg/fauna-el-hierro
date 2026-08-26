/**
 * Comprueba que todo enlace externo de los datos y del HTML responde.
 * Un enlace roto en una guía firmada por un profesional cuesta credibilidad,
 * y las fichas de turismo cambian de ruta sin avisar.
 *
 *   node scripts/check-links.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DATA = join(ROOT, "public", "data");

const urls = new Map(); // url -> [donde]

const add = (url, where) => {
  if (!/^https?:\/\//.test(url)) return;
  /* En el HTML hay href armados por concatenación: no son enlaces, son plantillas. */
  if (url.includes("' + ") || url.includes("'+")) return;
  if (!urls.has(url)) urls.set(url, []);
  urls.get(url).push(where);
};

/* Los datos: cualquier cadena que sea una URL, esté donde esté. */
const walk = (node, where) => {
  if (typeof node === "string") return add(node, where);
  if (Array.isArray(node)) return node.forEach((n, k) => walk(n, `${where}[${k}]`));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, `${where}.${k}`);
  }
};

for (const f of readdirSync(DATA).filter((f) => f.endsWith(".json"))) {
  walk(JSON.parse(readFileSync(join(DATA, f), "utf8")), f);
}

/* El HTML: los href literales del marcado, no los que arma el script. */
const html = readFileSync(join(ROOT, "public", "index.html"), "utf8");
for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) add(m[1].replace(/&amp;/g, "&"), "index.html");

console.log(`${urls.size} enlaces únicos\n`);

const AGENT = "Mozilla/5.0 (compatible; guia-el-hierro/1.0; +https://github.com/alipiomg/fauna-el-hierro)";

async function probe(url) {
  const opts = { redirect: "follow", headers: { "user-agent": AGENT } };
  try {
    /* Muchos servidores contestan 405 o 403 a HEAD; entonces se reintenta con GET. */
    let r = await fetch(url, { ...opts, method: "HEAD", signal: AbortSignal.timeout(20000) });
    if (r.status === 405 || r.status === 403 || r.status === 501) {
      r = await fetch(url, { ...opts, method: "GET", signal: AbortSignal.timeout(25000) });
    }
    return { status: r.status, final: r.url };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

const entries = [...urls.entries()];
const results = [];
const LOTE = 6;
for (let k = 0; k < entries.length; k += LOTE) {
  const lote = entries.slice(k, k + LOTE);
  const done = await Promise.all(lote.map(async ([url, where]) => ({ url, where, ...(await probe(url)) })));
  results.push(...done);
  process.stdout.write(".");
}
console.log("\n");

/* iNaturalist, GBIF y algunas aerolíneas rechazan clientes automatizados. Eso es
   un 403 al robot, no un enlace roto para una persona: se avisa, no se falla. */
const blocked = results.filter((r) => r.status === 403);
const bad = results.filter((r) => r.status === 0 || (r.status >= 400 && r.status !== 403));
const moved = results.filter((r) => r.status >= 200 && r.status < 400 && r.final
  && r.final.replace(/\/$/, "") !== r.url.replace(/\/$/, ""));

if (moved.length) {
  console.log(`${moved.length} redirigidos:`);
  for (const r of moved) console.log(`  ${r.url}\n    -> ${r.final}   [${r.where.join(", ")}]`);
  console.log("");
}

if (blocked.length) {
  console.log(`${blocked.length} devuelven 403 al robot (se abren bien en navegador): `
    + [...new Set(blocked.map((r) => new URL(r.url).host))].join(", ") + "\n");
}

if (bad.length) {
  console.log(`${bad.length} ROTOS:`);
  for (const r of bad) console.log(`  ${r.status || "sin respuesta"}  ${r.url}   [${r.where.join(", ")}]${r.error ? "\n    " + r.error : ""}`);
  process.exit(1);
}

console.log(`todos responden (${results.length})`);
