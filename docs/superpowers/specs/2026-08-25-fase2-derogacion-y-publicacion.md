# Fase 2 — Publicación en Vercel: qué se deroga del diseño de fase 1 y por qué

**Fecha:** 2026-08-25
**Estado:** ejecutado
**Deroga:** `2026-08-17-fauna-el-hierro-fase1-design.md`, secciones 4, 5, 6.2, 7-11 y 12
**Decide:** Alipio, sobre el potenciador `guia-hierro-v1`

---

## 1. Qué ha cambiado

El diseño de fase 1 aprobó **WordPress sobre hosting compartido**. La fase 2 publica un
**sitio estático en Vercel desde GitHub**. No conviven: son dos arquitecturas para el
mismo producto y hay que elegir una. Se elige Vercel.

El motivo no es técnico sino de tamaño del problema. La guía es un cuerpo de datos
cerrado —120 especies, 128 fotografías, 7 puntos de inmersión— que cambia por
correcciones puntuales, no por publicación continua. Un CMS con base de datos, roles y
caché de página resuelve un problema que este proyecto no tiene, y a cambio añade
superficie de mantenimiento, actualizaciones de seguridad y un servidor que atender.

## 2. Qué se deroga

| Sección de fase 1 | Estado | Motivo |
|---|---|---|
| 4. Arquitectura (WordPress, plugin `hierro-core`, tema `hierro`) | **Derogada** | No hay WordPress. La lógica vive en un único `index.html` |
| 5.1 Tipos de contenido (CPT `especie`) | **Derogada** | Sustituida por `public/data/species.json` |
| 5.2 Taxonomías (grupo, banda, frecuencia) | **Derogada como taxonomías** | Sobreviven como campos `g`, `b`, `f` dentro de cada ficha |
| 5.5 Avistamientos — tabla propia | **Aplazada** | Hoy la bitácora es local al navegador, con exportar e importar. Ver §5 |
| 5.6 Roles | **Derogada** | No hay usuarios. Agustín edita en GitHub, que ya tiene su propio control de acceso |
| 6.2 Tamaños de imagen (`add_image_size`) | **Derogada** | Las fotos se sirven tal cual desde el CDN de Vercel, con caché inmutable de un año |
| 7-10 Shell, home, explorar, ficha | **Cumplidas por otra vía** | El prototipo ya las implementaba; se conservan tal cual |
| 11. Publicación y despliegue completa | **Derogada** | Sin PHP, sin MySQL, sin LiteSpeed Cache, sin transients, sin `wp-cron`, sin límite de inodos |
| 12. Rendimiento (caché de página) | **Derogada** | Se sustituye por CDN estático más service worker |

## 3. Qué sobrevive intacto

- **5.3 Campos de especie.** Los nombres de campo del spec son los del JSON.
- **5.4 Licencias y atribución.** Sigue siendo la regla dura del proyecto: solo CC0,
  CC BY y CC BY-SA; autor, licencia y enlace visibles en cada ficha. Se aplicó también
  a los lugares, y por ella se retiró la foto `p11`, que decía *El Sabinar* pero era el
  CRA El Sabinar de Alpuente, Valencia.
- **6.1 Ingesta en local.** `tools/commons-ingest.py` y `tools/inat-commons-hunt.py`
  siguen siendo el pipeline de fotografía.
- **13. Accesibilidad.** Objetivos y pruebas siguen vigentes.

## 4. Lo que se contradijo dentro de la propia fase 2

Se ratificaron dos decisiones incompatibles tal cual estaban escritas:

- **d1**: publicar el HTML actual *sin reestructurar*.
- **d2**: que Agustín edite *los datos como JSON en GitHub*.

Con las fotos y los datos incrustados en base64 dentro del HTML no hay JSON que editar
ni foto que subir, y el extra de funcionamiento sin conexión obligaría a cachear 4,4 MB
de una vez. Resolución aplicada: **se mantiene la arquitectura de d1** —sitio estático,
sin framework, sin build, un solo HTML— y **se externalizan los datos y las fotografías**,
que es el mínimo que hace cierta d2.

Efecto medido: el HTML pasa de **4,4 MB a 113 KB**, y la primera carga real baja de
4,4 MB a poco más de medio megabyte, con las fotografías cargadas solo cuando se ven.

## 5. Riesgos abiertos y decisiones que siguen pendientes

1. **Bitácora multiusuario.** La certificación c7 dice que debe pasar a base de datos
   real. Hoy sigue siendo local al navegador con exportar e importar. Un sitio estático
   no lo resuelve solo: hará falta un backend, y esa es una fase aparte.
2. **Validación biológica.** 486 campos redactados en esta fase son borrador. Nadie con
   criterio de campo los ha revisado todavía. La web lo declara; eso no lo arregla.
3. **29 presencias sin resolver.** 24 dudosas y 5 probablemente ausentes de Canarias.
   Necesitan una sesión con Agustín, no más generación de texto.
4. **3 especies sin fotografía utilizable.** `Spirobranchus polytrema`, `Eunice roussaei`
   y `Raja maderensis`. La sección 6 del sistema de prompts contempla ilustración
   científica rotulada como tal; no se ha ejecutado.
5. **Coordenada errónea en la fuente oficial.** La ficha de *Baja Bocarones* de
   elhierro.travel repite la coordenada de *El Bajón*. El punto se publica sin pin en el
   mapa y con la advertencia visible, a la espera de confirmarlo con Agustín.
6. **Profundidad y nivel vienen de la fuente turística, no del autor.** El extra pedía
   los puntos «marcados por Agustín». Lo publicado es lo que publica Turismo de El
   Hierro. Falta su pasada.
7. **Dominio propio.** Se publica en la URL de Vercel. El dominio de Agustín y el correo
   profesional quedaron fuera de las decisiones ratificadas.
8. **Contacto único.** Solo hay Instagram. Sin teléfono, correo ni WhatsApp, la
   conversión del bloque de autor depende de una sola vía.
