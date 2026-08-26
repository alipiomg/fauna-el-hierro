/**
 * Merges the drafted content blocks into public/data/species.json.
 *
 * Runs the quality checks of docs/prompts/fichas-infografia.md §4 as code, so a
 * bad batch fails here and not under water:
 *   - every i must exist and appear once
 *   - no field may repeat verbatim across species (generic filler detector)
 *   - fields must stay inside the 15–45 word band
 *   - a species with a known hazard must declare risk
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR = join(ROOT, "scripts", "content");
const DATA = join(ROOT, "public", "data", "species.json");

/* {especies:[...]} desde que hay CMS; se acepta el array suelto. */
const rawSpecies = JSON.parse(readFileSync(DATA, "utf8"));
const species = Array.isArray(rawSpecies) ? rawSpecies : rawSpecies.especies;
const byId = new Map(species.map((s) => [s.i, s]));

const FIELDS = ["food", "repro", "def", "eco", "risk"];
const problems = [];
const seenText = new Map();
let applied = 0, nulls = 0;

const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const seenIds = new Set();

for (const file of files) {
  const batch = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  for (const rec of batch) {
    const sp = byId.get(rec.i);
    if (!sp) { problems.push(`${file}: i=${rec.i} no existe en species.json`); continue; }
    if (seenIds.has(rec.i)) { problems.push(`${file}: i=${rec.i} duplicado entre lotes`); continue; }
    seenIds.add(rec.i);

    for (const k of FIELDS) {
      if (!(k in rec)) continue;
      const v = rec[k];
      if (v === null) { nulls++; delete sp[k]; continue; }
      if (typeof v !== "string" || !v.trim()) { problems.push(`i=${rec.i} ${k}: valor no textual`); continue; }

      const words = v.trim().split(/\s+/).length;
      if (k !== "risk" && (words < 15 || words > 45)) {
        problems.push(`i=${rec.i} ${k}: ${words} palabras, fuera de 15–45`);
      }
      const norm = v.toLowerCase().replace(/[^a-záéíóúüñ ]/g, "").trim();
      if (seenText.has(norm)) {
        problems.push(`i=${rec.i} ${k}: texto idéntico al de i=${seenText.get(norm)} (relleno genérico)`);
      } else {
        seenText.set(norm, rec.i);
      }
      sp[k] = v.trim();
      applied++;
    }
  }
}

/* §4: a species that stings, bites or has spines and declares no risk is a
   publishing error, not a stylistic one. */
const HAZARD = [17, 19, 24, 25, 26, 27, 50, 58, 77, 107, 111, 112];
for (const i of HAZARD) {
  if (!byId.get(i)?.risk) problems.push(`i=${i}: especie con riesgo conocido y campo risk vacío`);
}

/* Rule 4: the model must never name a dive site; those are the author's field data. */
const SITES = /\b(El Baj[oó]n|Punta Restinga|La Caleta|Tacor[oó]n|La Restinga|El Desierto|Las Ca[nñ]as)\b/i;
for (const sp of species) {
  for (const k of FIELDS) {
    if (sp[k] && SITES.test(sp[k])) problems.push(`i=${sp.i} ${k}: cita un punto de inmersión concreto`);
  }
}

const missing = species.filter((s) => !seenIds.has(s.i)).map((s) => s.i);
if (missing.length) problems.push(`sin redactar: ${missing.join(", ")}`);

console.log(`lotes: ${files.length} · especies cubiertas: ${seenIds.size}/${species.length}`);
console.log(`campos escritos: ${applied} · declarados null: ${nulls}`);

const counts = {};
for (const k of FIELDS) counts[k] = species.filter((s) => s[k]).length;
console.log("cobertura:", Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));

if (problems.length) {
  console.error(`\n${problems.length} problemas:`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}

writeFileSync(DATA, JSON.stringify({ especies: species }, null, 1) + "\n", "utf8");
console.log(`\nescrito ${DATA}`);
