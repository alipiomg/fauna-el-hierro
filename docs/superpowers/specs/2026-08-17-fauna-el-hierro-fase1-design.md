# Fauna Marina de El Hierro — Fase 1: Cimientos + vertical Fauna

**Proyecto:** Fauna Marina de El Hierro – Guía de Buceo Profesional
**Autor del contenido:** Agustín Fragero Blesa · Dive Master
**Fecha:** 2026-08-17
**Revisión:** 2 — stack PHP/WordPress/MySQL (sustituye a la revisión 1 sobre Next.js/Supabase)
**Fase:** 1 de 4
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Objetivo

Construir los cimientos de una guía visual de la fauna marina y del territorio de El Hierro,
y entregar funcionando de extremo a extremo la primera vertical: **Explorar fauna**.

El criterio de calidad del proyecto es que la fotografía sea lo primero que atrae la atención
y el texto amplíe la experiencia visual, no al revés. Por eso la fase 1 no termina en un
esquema de base de datos: termina con una galería navegable poblada de fotografías reales,
legalmente utilizables y correctamente atribuidas.

## 2. Decisiones ratificadas

| Decisión | Valor |
|---|---|
| Punto de partida | Proyecto nuevo, desde cero, en `C:\Users\alimu\claude\Hierro` |
| Origen de las imágenes | Bancos con licencia libre + aportaciones de la comunidad de buceadores |
| Modelo de usuarios | Escritura por invitación de Agustín; lectura pública |
| Estrategia de construcción | Cimientos + vertical Fauna primero |
| Stack | PHP 8.2+, WordPress 6.x, MySQL 8 / MariaDB 10.6+ |
| Alojamiento | Hosting compartido con WordPress |

### Por qué WordPress y no PHP a medida

Cerca de la mitad de los requisitos son infraestructura ya resuelta por el CMS: biblioteca de
medios con subida, miniaturas, orden y texto alternativo; flujo de moderación para las fotos
comunitarias; usuarios, roles, capacidades, login e invitaciones; SEO con sitemaps y datos
estructurados. Construir eso desde cero multiplicaría el coste y concentraría el riesgo en la
autenticación, que es donde más fallos graves se cometen. A cambio, el autor del contenido puede
gestionar la web sin depender del desarrollador.

El punto débil conocido de WordPress —`wp_postmeta` es un almacén entidad-atributo-valor y
filtrar por varios campos implica varios JOIN— no muerde a la escala de este proyecto, del orden
de cientos de especies. Lo único que crece de verdad, los avistamientos, sale a tabla propia
(sección 5.5).

### Asunciones explícitas

1. **La lectura es pública.** Galería, fichas de especie y guía de la isla son accesibles sin
   cuenta e indexables. Lo cerrado es escribir: registrar avistamientos, subir fotografías y
   consultar la bitácora del grupo.
2. **No existe archivo fotográfico propio disponible a día de hoy.** El diseño no depende de él,
   pero el modelo contempla `own` como plataforma de origen para cuando lo haya.
3. **La web es actividad comercial.** Promociona a un Dive Master en ejercicio, luego las
   licencias `NonCommercial` no son utilizables.

## 3. Alcance

### Dentro de la fase 1

- Plugin `hierro-core` con el modelo de datos completo: tipos de contenido, taxonomías, campos
  de licencia sobre medios, tabla de avistamientos y roles, todo declarado ya aunque parte se
  active en fases posteriores.
- Ingestor de imágenes y datos taxonómicos desde bancos con licencia libre, ejecutable por WP-CLI.
- Pipeline de imagen: tamaños controlados, WebP/AVIF, carga diferida, placeholder difuminado.
- Tema `hierro` con el shell de navegación completo: cabecera fija, menú móvil, navegación
  inferior, modo claro/oscuro.
- Sección **Explorar fauna**: galería, filtros por categoría, paginación de 20, ficha de especie,
  visor a pantalla completa.
- Home con cabecera de impacto y franja de atajos a las diez categorías turísticas oficiales.

### Fuera de la fase 1

Avistamientos y "La he visto", registro por invitación, bitácora del grupo, progreso individual y
colectivo, fichas de lugar y de punto de inmersión, subida comunitaria con moderación, y PWA con
soporte sin conexión. Todo queda declarado en el modelo de datos y planificado en la sección 14.

Los botones de fases posteriores ("Registrar visto", "La he visto", favoritos) se muestran ya en
su sitio, deshabilitados y con etiqueta "próximamente", para no rediseñar la navegación después.

## 4. Arquitectura

Separación estricta entre dominio y presentación. El modelo de datos vive en un plugin, de modo
que un cambio de tema nunca se lleve por delante el contenido.

```
wp-content/
  plugins/hierro-core/
    hierro-core.php                 Cabecera, autoload, activación
    includes/
      class-post-types.php          CPT: especie, lugar, punto de inmersión
      class-taxonomies.php          Grupos taxonómicos, categorías turísticas
      class-meta.php                Campos de especie, registrados en REST
      class-media-license.php       Campos de licencia y atribución sobre adjuntos
      class-sightings.php           Tabla propia de avistamientos (fase 3)
      class-roles.php               Rol buceador y capacidades (fase 3)
      class-rest-api.php            /wp-json/hierro/v1/*
      class-queries.php             Consultas y cacheado
    cli/
      class-ingest-command.php      wp hierro ingest
    migrations/
  themes/hierro/
    functions.php                   Encolado, tamaños de imagen, soportes
    header.php  footer.php
    front-page.php                  Home visual
    archive-hierro_species.php      Galería
    single-hierro_species.php       Ficha de especie
    template-parts/
      navigation/  gallery/  media/  species/
    assets/
      css/   js/gallery.js  js/lightbox.js  js/theme.js
```

**Estrategia de renderizado.** El HTML se genera en PHP: es lo que da SEO, LCP bajo y
funcionamiento sin JavaScript. Encima, una REST API propia sirve "ver 20 especies más" y el
filtrado sin recarga. El JavaScript es propio y ligero, sin framework: visor, chips de filtro,
menú móvil y conmutador de tema. Presupuesto holgado frente al límite de la sección 12.

**Seguridad en tres capas**, adaptando la norma del operador a WordPress:
comprobación de capacidad (`current_user_can`) → validación y saneado de la entrada con nonce →
consulta preparada con `$wpdb->prepare` y filtrado por autoría. En fase 1 no hay mutaciones de
usuario, pero la estructura queda puesta.

## 5. Modelo de datos

### 5.1 Tipos de contenido

| Tipo | Slug público | Fase | Notas |
|---|---|---|---|
| `hierro_species` | `/fauna/{slug}` | 1 | Una especie |
| `hierro_place` | `/lugar/{slug}` | 2 | Playa, mirador, piscina natural, sendero, museo |
| `hierro_dive_site` | `/inmersion/{slug}` | 2 | Punto de inmersión |

Todos con soporte de título, editor, extracto, imagen destacada y revisiones, `show_in_rest`
activo y reescritura de URL propia.

### 5.2 Taxonomías

**`hierro_group`** — jerárquica, sobre `hierro_species`. Doce categorías taxonómicas reales:

peces óseos · tiburones · rayas · tortugas · cetáceos · pulpos y sepias · nudibranquios ·
moluscos · crustáceos · equinodermos · anémonas y corales · medusas y organismos gelatinosos

Cada término lleva imagen de portada, icono y orden como metadatos de término. La relación es de
muchos a muchos por naturaleza: un pulpo pertenece a *pulpos y sepias* y también a *moluscos*, y
ambas vistas deben poder contarlo.

**`hierro_place_category`** — las diez categorías turísticas oficiales, sobre `hierro_place`. Fase 2.

**Los cuatro filtros restantes de la lista original no son categorías.** Se resuelven así:

| Chip en la interfaz | Origen real |
|---|---|
| Especies nocturnas | Campo `_hierro_is_nocturnal` |
| Especies raras | Campo `_hierro_is_rare` |
| Especies vistas por mí | Consulta a la tabla de avistamientos (fase 3) |
| Especies pendientes | Negación de la anterior (fase 3) |

Se presentan al usuario igual que las categorías, pero almacenarlos como términos falsearía el
recuento de especies por categoría y duplicaría especies en los listados.

### 5.3 Campos de especie

Registrados con `register_post_meta`, con `show_in_rest`, tipo declarado y `sanitize_callback`:

`_hierro_scientific_name` · `_hierro_common_name_en` · `_hierro_size_cm_min` · `_hierro_size_cm_max`
`_hierro_depth_m_min` · `_hierro_depth_m_max` · `_hierro_habitat` · `_hierro_behavior_notes`
`_hierro_is_nocturnal` · `_hierro_is_rare` · `_hierro_iucn_status` · `_hierro_wikipedia_url`
`_hierro_inaturalist_taxon_id` · `_hierro_worms_aphia_id` · `_hierro_gbif_key`

El nombre científico se indexa aparte para poder buscar por él sin recorrer `wp_postmeta`.

### 5.4 Licencias y atribución sobre medios

Los adjuntos de la biblioteca de medios reciben campos propios, visibles y editables en la ficha
de cada archivo dentro de wp-admin:

`_hierro_author_name` · `_hierro_author_url` · `_hierro_source_url` · `_hierro_source_platform`
`_hierro_license_type` · `_hierro_license_url` · `_hierro_usage_permission`
`_hierro_image_category` · `_hierro_moderation_status`

**Licencias admitidas:** `CC0`, `CC-BY`, `CC-BY-SA`, `PUBLIC_DOMAIN`, `COMMUNITY_GRANTED`, `OWNED`.

**Riesgo asumido conscientemente.** MySQL y WordPress no ofrecen un tipo enumerado que impida a
nivel de base de datos guardar una licencia no comercial, como sí hacía el diseño anterior sobre
PostgreSQL. La restricción pasa a ser lógica de aplicación, validada en los tres puntos de
entrada: el ingestor por WP-CLI, el formulario de wp-admin y la REST API. Un acceso directo a la
base de datos podría saltársela. Se compensa con un comando `wp hierro audit-licenses` que revisa
la biblioteca completa y reporta cualquier adjunto con licencia no admitida o sin autor.

`_hierro_author_name` y el texto alternativo nativo de WordPress son **obligatorios**: sin autor
no se cumple la atribución que exigen las licencias CC, y sin texto alternativo la imagen no es
accesible. El guardado se rechaza si faltan.

La asociación de una foto a su especie usa `post_parent` cuando se sube desde la ficha, y el
campo `_hierro_species_id` cuando se asigna desde el ingestor o desde la biblioteca.

### 5.5 Avistamientos — tabla propia

```sql
CREATE TABLE {prefix}hierro_sightings (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  species_id    BIGINT UNSIGNED NOT NULL,
  dive_site_id  BIGINT UNSIGNED NULL,
  sighted_at    DATETIME NOT NULL,
  depth_m       DECIMAL(5,1) NULL,
  notes         TEXT NULL,
  media_id      BIGINT UNSIGNED NULL,
  is_public     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_species (species_id),
  KEY idx_user_species (user_id, species_id),
  KEY idx_site (dive_site_id),
  KEY idx_recent (created_at)
) {charset_collate};
```

**Sin restricción de unicidad, deliberadamente.** Un buceador ve la misma especie en muchas
inmersiones y debe poder registrar cada observación con su fecha, profundidad y notas. "La he
visto" no es una fila distinta: es la existencia de al menos una, y se deriva con
`COUNT(*) > 0`. El listado "especies vistas por mí" usa `SELECT DISTINCT species_id`, y el
progreso colectivo `COUNT(DISTINCT user_id)` por especie. El índice `idx_recent` sirve a la
bitácora del grupo, que es un listado cronológico inverso.

**Por qué no es un tipo de contenido.** Los avistamientos son dato transaccional de alto volumen
y las vistas que los consumen son agregaciones: cuántas especies ha visto un usuario, cuántos
usuarios han visto una especie. Como CPT, cada registro ocuparía una fila en `wp_posts` más
varias en `wp_postmeta`, y el progreso colectivo exigiría JOIN sobre un EAV. Con tabla propia e
índices, ambas consultas son directas.

Progreso individual y colectivo se calculan con `COUNT(DISTINCT ...)` y se cachean en el caché de
objetos, invalidando al insertar un avistamiento.

### 5.6 Roles

Rol `buceador` con capacidades para registrar avistamientos y subir fotografías propias en estado
pendiente. El registro abierto queda desactivado; el alta es por invitación de un administrador.
Se declara en fase 1 y se activa en fase 3.

## 6. Pipeline de medios

### 6.1 Ingesta

**La ingesta se ejecuta en local, nunca en producción.** Es la consecuencia más importante de
alojar en hosting compartido: allí el tiempo máximo de ejecución de PHP ronda los 30-60 segundos,
la memoria está limitada, las peticiones salientes suelen estar restringidas y el acceso por SSH
—y por tanto WP-CLI— no está garantizado. Un ingestor que descarga cientos de imágenes desde API
externas y genera miles de derivados moriría a mitad, una y otra vez.

El proceso queda partido en dos:

- **En local**, sobre una copia de WordPress, corre `wp hierro ingest`: consulta las API, descarga,
  filtra licencias, genera todas las variantes de imagen y puebla la base de datos.
- **A producción** viaja el resultado ya cocinado: los ficheros de `uploads` por sincronización, y
  el contenido mediante `wp hierro export` / `wp hierro import`, que serializa especies, campos,
  términos y metadatos de licencia en un JSON versionado.

Así producción nunca depende de servicios de terceros ni de límites de ejecución, y la ingesta
puede repetirse y depurarse cuantas veces haga falta sin tocar la web publicada.

Comando `wp hierro ingest`, idempotente y reanudable, invocable por especie o por lote:

1. **Taxonomía.** Consulta a WoRMS y GBIF: nombre científico validado, rango y jerarquía.
2. **Fotografías.** API de iNaturalist restringida a observaciones de calidad de investigación en
   el área de El Hierro, leyendo `license_code` y `attribution` de cada foto. Wikimedia Commons
   como fuente secundaria.
3. **Filtro de licencia.** Toda foto cuyo código no esté admitido se descarta antes de descargarse.
   Es la primera operación tras recibir la respuesta, no la última.
4. **Descripción.** Extracto de Wikipedia en español, registrando la atribución `CC-BY-SA`.
5. **Ingreso.** La imagen se descarga y entra en la biblioteca de medios mediante
   `media_handle_sideload`. No se enlaza nunca al servidor de origen: el hotlink es frágil,
   impide optimizar y traslada carga a un tercero sin su consentimiento.
6. **Metadatos.** Alta de todos los campos de atribución y del texto alternativo.
7. **Publicación.** La especie pasa a publicada solo si tiene al menos una fotografía utilizable.

Objetivo de la primera ejecución: **50 especies publicables** con fotografía.

Control de tasa y registro de progreso en una opción propia, para poder reanudar sin repetir
peticiones. iNaturalist y GBIF limitan las peticiones por minuto.

### 6.2 Tamaños de imagen

WordPress genera de serie varios tamaños por cada subida, y el tema añade los suyos. Con miles de
fotografías eso multiplica ficheros y espacio en disco sin necesidad. La fase 1 **desactiva los
tamaños innecesarios** y declara exactamente cinco: `hierro_thumb` (320), `hierro_card` (640),
`hierro_medium` (960), `hierro_large` (1440) y `hierro_hero` (1920), todos con `srcset`.

Conversión a WebP en los cinco tamaños y a AVIF **solo en los tres grandes** (960, 1440 y 1920),
que es donde el ahorro compensa: en una miniatura de 320 px la diferencia entre AVIF y WebP es de
unos pocos kilobytes y no justifica duplicar ficheros. Se conserva el original como reserva.

Esa decisión deja 9 ficheros por fotografía en lugar de 11. Importa porque **los hostings
compartidos limitan el número de ficheros, no solo el espacio**: el límite de inodos suele estar
entre 200.000 y 500.000, y una biblioteca de 2.000 fotografías con todas sus variantes ronda los
18.000 ficheros. Hay margen, pero conviene medirlo antes de crecer y no dejar que WordPress genere
tamaños por su cuenta.

Toda la conversión ocurre **en local durante la ingesta**, no en el servidor. El placeholder
difuminado se genera también entonces y se guarda como metadato del adjunto.

### 6.3 Presentación y atribución

Cada fotografía lleva su crédito visible al pie: autor enlazado a su perfil, licencia enlazada a
su texto legal, fuente enlazada a la página de origen. Los enlaces externos abren en pestaña nueva
con `rel="noopener noreferrer"` e indicador visual.

Página `/creditos` con el listado completo de obras utilizadas, su autoría y su licencia, como
respaldo del cumplimiento de `CC-BY` y `CC-BY-SA`.

## 7. Shell de navegación

**Cabecera fija**, visible durante todo el desplazamiento, en móvil y escritorio.

Escritorio: nombre corto "Guía El Hierro", accesos a Inicio, Fauna, Guía de la isla y La Restinga,
desplegable "Explorar" con las categorías secundarias, buscador, conmutador de tema y, reservado
para la fase 3, el acceso al área de usuario.

Móvil: título corto, acceso destacado a "Registrar visto" y botón de menú siempre visible. El menú
se abre a pantalla completa, con iconos, objetivos táctiles amplios, buscador global, enlaces
rápidos a las categorías turísticas y botón de cierre evidente.

**Navegación inferior en móvil** con cinco accesos: Inicio · Fauna · Registrar visto · Guía · Menú.

**Modo claro y oscuro** en tres estados: elección explícita persistida en `localStorage`, y
respeto a la preferencia del sistema por defecto. La clase se aplica antes del primer pintado
para evitar el destello de tema incorrecto.

## 8. Home

Cabecera de gran impacto con imagen de fondo optimizada y prioridad de carga, título
"Fauna Marina de El Hierro", subtítulo "Guía de Buceo Profesional y Guía de Viaje", autoría de
Agustín Fragero Blesa · Dive Master, y cuatro botones: Explorar fauna, Ver guía de la isla,
Registrar un avistamiento y Descubrir La Restinga.

Debajo, la **franja de atajos visuales** a las diez categorías turísticas oficiales. Cada tarjeta
con imagen, icono, nombre, frase de orientación, botón "Explorar", enlace interno a la categoría
y enlace externo a la fuente oficial de Turismo de El Hierro:

| Categoría | Fuente oficial |
|---|---|
| Espacios naturales | `elhierro.travel/espacios-naturales-el-hierro/` |
| Lugares con encanto | `elhierro.travel/lugares-con-encanto-el-hierro/` |
| Miradores | `elhierro.travel/miradores-el-hierro/` |
| Parapente | `elhierro.travel/zonas-de-despegue-parapente-en-el-hierro/` |
| Piscinas naturales | `elhierro.travel/piscinas-naturales-el-hierro/` |
| Playas | `elhierro.travel/playas-el-hierro/` |
| Puntos de inmersión | `elhierro.travel/puntos-de-inmersion-el-hierro/` |
| Senderos | `elhierro.travel/senderos-el-hierro/` |
| Observación de estrellas | `elhierro.travel/observacion-de-estrellas-en-el-hierro/` |
| Museos y visitas de interés | `elhierro.travel/museos-y-visitas-de-interes-en-el-hierro/` |

En fase 1 las páginas internas de categoría existen como plantilla con el bloque
"Más información oficial sobre [categoría]" y su botón al enlace oficial; se pueblan en fase 2.

## 9. Explorar fauna

**Cuadrícula.** Tarjetas donde inicialmente solo se ve la fotografía. Al pasar el cursor en
escritorio aparece una capa inferior suave con nombre común y científico. En móvil, al tocar se
abre un panel breve con el nombre y el botón "Ver ficha".

**Filtros.** Chips grandes con icono en la parte superior, con imagen de portada y número de
especies por categoría. Los filtros de progreso personal y colectivo aparecen deshabilitados
hasta la fase 3.

**Paginación.** 20 especies por carga, con las dos navegaciones pedidas: control de páginas
(Anterior · Página X de Y · Siguiente) con el indicador "Mostrando 1–20 de X especies", y botón
"Ver 20 especies más" que acumula sin perder lo ya cargado, sirviéndose de la REST API. Carga
diferida de imágenes en ambos casos.

**Estado en la URL.** Categoría, filtros y página viajan como parámetros de consulta, y la
posición se restaura al volver desde una ficha. Además de resolver tu requisito de "recordar
filtro y posición", hace que cada vista filtrada sea enlazable, compartible e indexable.

**Sin JavaScript la galería sigue funcionando**: la paginación por páginas es navegación real en
PHP. El botón "ver 20 más" y el visor son mejoras progresivas.

**Visor.** Pantalla completa, gestos de deslizamiento en móvil, navegación entre especies sin
volver al listado, y ampliación de la imagen.

## 10. Ficha de especie

Fotografía principal grande arriba, galería deslizable debajo, datos clave en tarjetas
(talla, profundidad, hábitat, comportamiento, estado IUCN), explicación ampliable, y enlaces
externos al final hacia Wikipedia, WoRMS y GBIF. Crédito al pie de cada imagen. Botones de
ampliar y compartir activos; "La he visto", "Añadir observación" y favorito visibles y
deshabilitados hasta la fase 3.

## 11. Publicación y despliegue

### 11.1 Requisitos y límites del servidor

PHP 8.2 o superior con `imagick` o `gd`, MySQL 8 / MariaDB 10.6 o superior, WordPress 6.x y
HTTPS obligatorio.

**Sin caché de objetos persistente.** En hosting compartido rara vez hay Redis o Memcached, así
que la estrategia de caché cambia: el peso recae en la **caché de página** —LiteSpeed Cache si el
servidor es LiteSpeed, que es lo habitual en compartido, o WP Super Cache en su defecto—, de modo
que la inmensa mayoría de las visitas se sirvan como HTML estático sin tocar PHP ni MySQL.

Para lo que no se puede cachear como página, los recuentos por categoría y las consultas de
taxonomía se guardan en **transients con expiración explícita** y `autoload` desactivado. Los
transients sin caducidad son una fuente conocida de inflado de `wp_options`, y el
`autoload` descontrolado degrada todas las páginas del sitio: ningún transient de este proyecto
se crea sin TTL.

**Límites que hay que dar por supuestos:** tiempo máximo de ejecución de 30-60 segundos, memoria
de 128-256 MB, peticiones salientes posiblemente restringidas, `wp-cron` dependiente de visitas y
límite de inodos. El diseño los evita moviendo la ingesta a local (sección 6.1) en lugar de
intentar sortearlos.

### 11.2 Qué se versiona

Git cubre **solo el plugin `hierro-core` y el tema `hierro`**. Fuera del repositorio quedan el
núcleo de WordPress, los plugins de terceros, `wp-config.php` y `wp-content/uploads`. Las
credenciales van en variables de entorno o en un `wp-config` local, nunca en el repositorio.

### 11.3 Entornos

Local (LocalWP o Docker) → staging en subdominio con `noindex` → producción. La base de datos se
promociona con `wp db export` y `wp search-replace` de dominios, nunca copiando a mano.

### 11.4 Procedimiento de despliegue

El método depende de si el alojamiento ofrece acceso SSH, cosa que varía entre proveedores de
hosting compartido. **El plan contempla los dos casos y no depende de tenerlo:**

**Con SSH.** Sincronización con `rsync` siguiendo las normas de operación vigentes:

1. **Siempre `--dry-run` primero**, y revisar la salida antes de ejecutar de verdad.
2. **Nunca `--delete`.** Si hay que eliminar algo, se hace con una orden explícita e independiente.
3. Excluir siempre `wp-content/uploads/`, cachés, `node_modules/`, `vendor/`, `.git/` y `.env`.
4. Tras sincronizar: purgar la caché de página, `wp rewrite flush` y comprobar la home y una ficha.

**Sin SSH.** Espejo por SFTP con `lftp mirror --dry-run` primero y sin borrado remoto, aplicando
las mismas exclusiones. Las tareas que en el caso anterior haría WP-CLI —migraciones de esquema e
importación de contenido— se ejecutan desde una pantalla propia en wp-admin, protegida por
capacidad de administrador y nonce, que procesa por lotes para no agotar el tiempo de ejecución.

Las migraciones de esquema —creación de la tabla de avistamientos, altas de roles— llevan control
de versión propio en una opción, de modo que sean idempotentes y se puedan lanzar por cualquiera
de las dos vías.

**Las fotografías siguen su propio camino.** No viajan por Git ni se generan en producción: se
producen en local durante la ingesta y se suben como ficheros ya optimizados, junto al JSON de
contenido que las asocia a cada especie con su cadena de atribución.

### 11.5 Copias de seguridad

Antes de cada despliegue: volcado de base de datos y copia de `uploads`. Las fotografías con su
cadena de atribución son el activo más caro de reconstruir del proyecto.

## 12. Rendimiento

Presupuesto que la fase 1 debe cumplir en 4G móvil simulado:

| Métrica | Objetivo |
|---|---|
| LCP | < 2,5 s |
| CLS | < 0,1 |
| INP | < 200 ms |
| JS propio en la galería | < 60 KB comprimido |
| Peso de imagen por página de 20 | < 900 KB |
| Consultas por página | < 40 |

Medidas: caché de página como pieza principal —dado que no hay caché de objetos persistente,
véase la sección 11.1—, transients con expiración para recuentos y taxonomías, AVIF en los
tamaños grandes con reserva WebP, `srcset` por ancho de pantalla, `fetchpriority="high"` solo en
la imagen de cabecera, carga diferida en el resto, dimensiones siempre declaradas para evitar
saltos de maquetación, difuminado durante la carga y cabeceras de caché largas sobre `uploads`.

El presupuesto de consultas por página se mide **con la caché de página desactivada**: es el peor
caso real, el que sufre el primer visitante de cada página y el que determina si el sitio aguanta
cuando la caché se purga tras una actualización.

En el bucle de la galería se precargan los metadatos y los términos de todas las especies de la
página en una sola consulta, para no incurrir en el patrón N+1 clásico de WordPress. Nunca se
cargan todas las fotografías a la vez.

## 13. Accesibilidad y pruebas

Texto alternativo obligatorio al guardar. Contraste AA en ambos temas. Navegación completa por
teclado, incluido el visor, que atrapa el foco y se cierra con `Escape`. Objetivos táctiles de
44 px como mínimo en la navegación móvil. Respeto a `prefers-reduced-motion`.

Pruebas:

- **PHPUnit con `WP_UnitTestCase`** sobre el plugin: rechazo de licencias no admitidas en los tres
  puntos de entrada, obligatoriedad de autor y texto alternativo, idempotencia del ingestor,
  registro correcto de tipos y taxonomías, y consultas de la REST API.
- **Playwright** sobre el tema: filtrado por categoría, ambas paginaciones, apertura de ficha y
  regreso conservando posición y filtro, visor con teclado y con gestos, y funcionamiento de la
  galería con JavaScript desactivado.
- **Lighthouse CI** contra el presupuesto de la sección 12, como puerta de despliegue.
- **PHPCS con WordPress Coding Standards** en integración continua.

## 14. Roadmap posterior

**Fase 2 — Guía de la isla.** Tipos `hierro_place` y `hierro_dive_site` activos, fichas con
galería de 4 a 10 imágenes, mapa, acceso y entorno; las diez categorías turísticas pobladas;
La Restinga como ficha destacada.

**Fase 3 — Avistamientos y comunidad.** Alta del rol `buceador` y del registro por invitación,
tabla de avistamientos en uso, "La he visto", Mis avistamientos, bitácora del grupo, progreso
individual y colectivo, favoritos, y subida comunitaria de fotografías con cesión de derechos y
moderación desde wp-admin.

**Fase 4 — Pulido y PWA.** Refinado del panel de administración con las vistas propias que wp-admin
no cubra —ordenación visual de galerías y elección de portada—, PWA con soporte parcial sin
conexión para fichas e imágenes recientes, y bloque social del autor enlazando a
`instagram.com/agustin_fragero`, sin incrustar publicaciones mediante scripts externos pesados.

## 15. Riesgos abiertos

1. **Cobertura fotográfica desigual.** Los bancos libres cubren bien peces e invertebrados
   llamativos, y mal las especies crípticas o nocturnas. Mitigación: publicar solo las especies
   que alcanzan una fotografía utilizable, y mantener el resto sin publicar hasta que la
   comunidad aporte imagen.
2. **La restricción de licencias es lógica, no estructural.** Ver sección 5.4. Mitigación:
   validación en tres puntos de entrada más el comando de auditoría periódica.
3. **Rendimiento bajo carga fotográfica.** WordPress no es rápido por defecto con miles de
   imágenes, y el hosting compartido no ofrece caché de objetos persistente. Mitigación: tamaños
   limitados a cinco, caché de página obligatoria, transients con expiración, y el presupuesto de
   la sección 12 —medido sin caché de página— como puerta de despliegue.

6. **Límites del hosting compartido.** Tiempo de ejecución, memoria, inodos y posible ausencia de
   SSH. Es el riesgo con más consecuencias de diseño, y por eso se ataca de raíz: la ingesta y el
   procesado de imagen ocurren en local (secciones 6.1 y 6.2), y el despliegue está definido para
   funcionar con SSH o sin él (sección 11.4). Queda pendiente **verificar en el proveedor concreto**
   la versión de PHP, la disponibilidad de SSH, el límite de inodos y si el servidor es LiteSpeed,
   antes de cerrar el plan de implementación.
4. **Dependencia de API externas en la ingesta.** iNaturalist y GBIF limitan la tasa de
   peticiones. Mitigación: ingestor idempotente, reanudable y con control de tasa.
5. **Superficie de ataque del CMS.** WordPress es el gestor más atacado. Mitigación: mínimo de
   plugins de terceros, actualizaciones al día, `DISALLOW_FILE_EDIT`, permisos correctos de
   ficheros y copias de seguridad previas a cada despliegue.
