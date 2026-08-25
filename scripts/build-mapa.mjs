/**
 * Builds public/data/isla.json: the real coastline of El Hierro, simplified to
 * something an SVG can draw, plus the projection used to place dive sites.
 *
 * Source: OpenStreetMap via Nominatim (relation 2214681), ODbL.
 * Input .work/nom.json is fetched once by hand; the output is committed so the
 * site never depends on a third-party API at runtime.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const raw = JSON.parse(readFileSync(join(ROOT, ".work", "nom.json"), "utf8"));
const polys = raw[0].geojson.coordinates;

/* The island itself is the ring with by far the most points; the other 146 are
   buildings and rocks that the political boundary happens to trace. */
let ring = [];
for (const p of polys) if (p[0].length > ring.length) ring = p[0];
console.log(`anillo original: ${ring.length} puntos`);

/* Equirectangular projection anchored on the island, y down. */
const lats = ring.map((c) => c[1]);
const lons = ring.map((c) => c[0]);
const bounds = {
  west: Math.min(...lons), east: Math.max(...lons),
  south: Math.min(...lats), north: Math.max(...lats)
};
const mid = (bounds.north + bounds.south) / 2;
const kx = Math.cos((mid * Math.PI) / 180);

const PAD = 26;
const W = 1000;
const spanX = (bounds.east - bounds.west) * kx;
const scale = (W - PAD * 2) / spanX;

const project = ([lon, lat]) => [
  PAD + (lon - bounds.west) * kx * scale,
  PAD + (bounds.north - lat) * scale
];

/* Ramer–Douglas–Peucker. A coastline drawn at 1000 px wide does not need
   12.000 vertices, and every one of them costs bytes on a boat with no signal. */
function rdp(points, eps) {
  if (points.length < 3) return points;
  let index = 0, dmax = 0;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
  const dx = bx - ax, dy = by - ay;
  const norm = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / norm;
    if (d > dmax) { index = i; dmax = d; }
  }
  if (dmax <= eps) return [points[0], points[points.length - 1]];
  return [
    ...rdp(points.slice(0, index + 1), eps).slice(0, -1),
    ...rdp(points.slice(index), eps)
  ];
}

/* RDP needs an open polyline: on a closed ring the first and last point
   coincide and the baseline degenerates. Cut the ring at its two most distant
   points and simplify each half. */
const projected = ring.map(project);
const open = projected[0][0] === projected.at(-1)[0] && projected[0][1] === projected.at(-1)[1]
  ? projected.slice(0, -1)
  : projected;
let far = 0, farD = 0;
for (let i = 1; i < open.length; i++) {
  const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
  if (d > farD) { farD = d; far = i; }
}
const halves = [open.slice(0, far + 1), [...open.slice(far), open[0]]];
const simplify = (e) => {
  const [a, b] = halves.map((h) => rdp(h, e));
  return [...a.slice(0, -1), ...b.slice(0, -1)];
};

let eps = 0.4, simple = simplify(eps);
while (simple.length > 260 && eps < 40) { eps *= 1.3; simple = simplify(eps); }
console.log(`simplificado: ${simple.length} puntos (eps ${eps.toFixed(2)} px)`);

const path = simple
  .map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
  .join("") + "Z";

/* Reserve boundary, from the official description at mapa.gob.es. The four
   vertices are the published limits, not a drawing. */
const dm = (d, m) => d + m / 60;
const reserva = [
  [-dm(17, 58.59), dm(27, 38.28)],
  [-dm(17, 58.90), dm(27, 36.60)],
  [-dm(18, 2.24), dm(27, 40.35)],
  [-dm(18, 1.81), dm(27, 40.73)]
].map(project);

/* The reserve reaches further south than the island, so the canvas has to
   follow it or the boundary would be clipped off the bottom. */
const H = Math.round(Math.max(
  ...simple.map(([, y]) => y),
  ...reserva.map(([, y]) => y)
) + PAD);

const out = {
  fuente: "OpenStreetMap (relación 2214681) · ODbL",
  viewBox: `0 0 ${W} ${H}`,
  bounds,
  proyeccion: { pad: PAD, scale, kx, west: bounds.west, north: bounds.north },
  costa: path,
  reserva: reserva.map(([x, y]) => [Number(x.toFixed(1)), Number(y.toFixed(1))]),
  lugares: [
    { n: "La Restinga", lon: -dm(17, 58.59), lat: dm(27, 38.28), tipo: "puerto" },
    { n: "Valverde", lon: -17.9158, lat: 27.8060, tipo: "capital" },
    { n: "Puerto de La Estaca", lon: -17.8955, lat: 27.7875, tipo: "puerto" },
    { n: "Aeropuerto (VDE)", lon: -17.8871, lat: 27.8148, tipo: "aeropuerto" },
    { n: "Faro de Orchilla", lon: -18.1478, lat: 27.6989, tipo: "faro" }
  ].map((p) => {
    const [x, y] = project([p.lon, p.lat]);
    return { ...p, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  })
};

writeFileSync(join(ROOT, "public", "data", "isla.json"), JSON.stringify(out, null, 1) + "\n", "utf8");
console.log(`viewBox ${out.viewBox} · path ${path.length} caracteres`);
