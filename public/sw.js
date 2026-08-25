/* Service worker de la Guía Fauna Marina de El Hierro.
 *
 * El caso de uso manda sobre la elegancia: en La Restinga la cobertura es
 * irregular y en el barco no hay ninguna. La guía tiene que abrir igual.
 *
 *   - Cáscara y datos: se precachean en la instalación. Sin ellos no hay guía.
 *   - Fotografías: se cachean a medida que se ven, con tope, porque son 3 MB y
 *     nadie necesita las 128 antes de la primera inmersión.
 *
 * Al cambiar VERSION se descarta la caché anterior entera.
 */
const VERSION = "hierro-v1";
const SHELL = VERSION + "-shell";
const FOTOS = VERSION + "-fotos";
const MAX_FOTOS = 140;

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "data/species.json",
  "data/photos.json",
  "data/viaje.json",
  "data/autor.json",
  "data/isla.json",
  "data/inmersiones.json",
  "fotos/hero.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== FOTOS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Recorta la caché de fotos por orden de entrada. No es LRU real, pero evita
   que el almacenamiento crezca sin límite en un móvil de trabajo. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/* Descarga completa a peticion del usuario: en el muelle, con wifi, antes de
   salir. De ocho en ocho para no saturar una conexion mala, informando del
   avance por el puerto que abre la pagina. */
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type !== "precache-fotos") return;
  const port = event.ports && event.ports[0];
  const urls = msg.urls || [];

  event.waitUntil((async () => {
    const cache = await caches.open(FOTOS);
    let hechas = 0, fallos = 0;
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(urls.slice(i, i + 8).map(async (u) => {
        try {
          if (await cache.match(u)) return;
          const res = await fetch(u, { cache: "reload" });
          if (res.ok) await cache.put(u, res); else fallos++;
        } catch (err) {
          fallos++;
        }
      }));
      hechas = Math.min(i + 8, urls.length);
      if (port) port.postMessage({ type: "progreso", hechas, total: urls.length });
    }
    /* El tope de recorte tiene que caber la coleccion entera o se mordería la
       cola justo despues de descargarla. */
    await trim(FOTOS, Math.max(MAX_FOTOS, urls.length));
    if (port) port.postMessage({ type: "listo", total: urls.length, fallos });
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Fotografías: cache primero. Una foto no cambia; si está, se sirve. */
  if (url.pathname.includes("/fotos/")) {
    event.respondWith((async () => {
      const cache = await caches.open(FOTOS);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) { await cache.put(req, res.clone()); trim(FOTOS, MAX_FOTOS); }
        return res;
      } catch (err) {
        return new Response("", { status: 504, statusText: "sin conexión" });
      }
    })());
    return;
  }

  /* Cáscara y datos: red primero para que una corrección de Agustín llegue en
     cuanto haya cobertura, con la caché como red de seguridad. */
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    try {
      const res = await fetch(req);
      if (res.ok) await cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req) || await cache.match("index.html");
      if (hit) return hit;
      return new Response("Sin conexión y sin copia guardada.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
