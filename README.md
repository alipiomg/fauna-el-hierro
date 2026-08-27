# Fauna Marina de El Hierro

Guía de identificación de las 120 especies del **Mar de las Calmas**, en la Reserva
Marina de Punta de La Restinga (El Hierro, Canarias).

Contenido de buceo por **Agustín Fragero Blesa**, Dive Master en La Restinga.
Sitio estático, sin framework ni paso de compilación: se publica en Vercel tal cual.

---

## Cómo se publica

Vercel sirve la carpeta `public/` directamente. No hay `build`. Cada `push` a `main`
redespliega solo, así que **editar un JSON en GitHub actualiza la web en un minuto**.

```
public/                 ← lo que Vercel publica
  index.html            plantilla; toda la lógica vive aquí
  data/*.json           el contenido editable
  fotos/*.webp          128 fotografías con licencia comercial
  sw.js                 funcionamiento sin conexión
  manifest.webmanifest  instalable en el móvil
```

---

## El panel de edición

**https://fauna-el-hierro.vercel.app/admin/**

Sveltia CMS. No hay base de datos ni servidor: el panel es una página que corre
en el navegador y habla directamente con la API de GitHub. Al guardar hace un
commit sobre este repositorio y Vercel redespliega solo. El contenido siguen
siendo los mismos JSON de `public/data/`, editables también a mano.

### Entrar la primera vez

1. En GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. *Repository access*: sólo `alipiomg/fauna-el-hierro`.
3. *Permissions → Repository permissions*: **Contents → Read and write**.
4. Copiar el token y pegarlo en el panel, en **Sign In with Token**.

El token se queda guardado en ese navegador. Si caduca, se genera otro igual.

No hace falta registrar ninguna aplicación OAuth ni desplegar nada. Si algún día
molesta tener que renovar el token, se despliega el autenticador de Sveltia en
Cloudflare Workers (también gratis) y se añade `base_url` a `config.yml`.

### Actualizar el CMS

El paquete se sirve desde el propio sitio, no desde un CDN, para que el panel no
dependa de que unpkg esté en pie:

```bash
npm run cms:update
```

### Lo que el panel no toca

`photos.json` lo genera `npm run extract` y sus claves están ligadas a los
ficheros de `public/fotos/`. Editarlo a mano rompe el vínculo. Para poner una
foto propia en una especie están los campos de fotografía dentro de su ficha,
que obligan a declarar autor y licencia.

---

## Lo que Agustín puede cambiar sin tocar código

Todo está en `public/data/`. Se editan desde GitHub: abrir el fichero, botón del
lápiz, guardar. Son JSON: respeta las comillas y las comas.

| Fichero | Qué contiene |
|---|---|
| `species.json` | Las 120 fichas: nombre, talla, profundidad, los cuatro bloques biológicos, avisos de riesgo |
| `photos.json` | Autoría y licencia de cada fotografía |
| `inmersiones.json` | Puntos de inmersión: profundidad, nivel, acceso, descripción |
| `viaje.json` | Cómo llegar y moverse: operadores, duraciones, alojamiento |
| `quever.json` | Imprescindibles de la isla, con sus leyendas, y los recorridos por días |
| `bici.json` | Rutas en bicicleta y los trucos de la isla |
| `autor.json` | Biografía, la carta larga de la sección "Bucear con Agustín", la recomendación de Oquea, canales de contacto y llamada a la acción |
| `isla.json` | Costa y límites del mapa. **No lo toques**: se genera con un script |

### Añadir un canal de contacto

En `autor.json`, dentro de `contacto`:

```json
{ "t": "WhatsApp", "v": "+34 600 000 000", "url": "https://wa.me/34600000000" }
```

El que lleve `"primario": true` es el que aparece como botón grande.

### Editar la carta de "Bucear con Agustín"

En `autor.json`, el campo `carta` es una lista de bloques con título y párrafos:

```json
{ "titulo": "Un título nuevo", "parrafos": ["Primer párrafo.", "Segundo párrafo."] }
```

Se pintan en ese orden, debajo de la tarjeta compacta. `lema` es la cita destacada
a media carta, `payoff` es la frase grande en mayúsculas del final (admite un
salto de línea con `\n`), y `despedida` son los párrafos de cierre antes de la firma.

El bloque `oquea` controla el aviso de la app: `app_url` es el enlace de descarga
que aparece como botón sólido y bien visible — no lo dejes vacío ni apuntando a
una URL genérica de tienda, tiene que ser el enlace directo a la ficha de Oquea.

### Añadir un lugar imprescindible o un recorrido

En `quever.json`. Un lugar va en `imprescindibles`:

```json
{ "n": "Nombre", "zona": "Municipio · comarca", "d": "Por qué merece la pena.",
  "dato": "Cota, tiempo o aviso corto", "url": "https://elhierro.travel/…",
  "maps": "https://www.google.com/maps/search/?api=1&query=…" }
```

`"destacado": true` le pone borde de acento. Si le añades un array `leyendas` con
objetos `{ "t": "...", "d": "..." }`, el lugar sube a ficha grande arriba del todo,
como el Garoé.

Un recorrido va en `recorridos`, y su `altitud` sólo admite dos valores:
`"nivel del mar"` o `"sube a la cumbre"`. Ese campo es el que pinta el distintivo
que avisa de si el plan se puede hacer el mismo día que se bucea.

### Marcar una especie como validada

El campo `validado` de cada especie es el que decide si la web la enseña como
contenido revisado o como borrador. Con él a `false` —o ausente— la ficha lleva
el aviso de borrador; con él a `true` sale el distintivo verde y la especie entra
en el filtro *Validadas por Agustín*.

El aviso general de la sección de fuentes cuenta solas cuántas quedan, y
desaparece cuando estén las 120. **Actívalo sólo cuando hayas leído la ficha
entera**: es lo único que separa una redacción de trabajo de una edición firmada.

### Corregir el texto de una especie

Busca su `"i"` en `species.json` y edita el campo. Los campos son:
`food` alimentación · `repro` reproducción · `def` defensa · `eco` papel ecológico ·
`risk` aviso de peligro real · `id` cómo reconocerla · `ha` hábitat · `be` observación ·
`ex` nota de experto.

Un campo que no exista simplemente no se dibuja. **Si no estás seguro de un dato,
bórralo antes que dejar algo dudoso**: un hueco es correcto, una frase inventada no.

### Añadir una fotografía tuya

1. Sube el `.webp` o `.jpg` a `public/fotos/`.
2. En `photos.json` añade la entrada con la clave `s` + número de especie:

```json
"s29": { "f": "s29.webp", "a": "Agustín Fragero", "l": "CC BY-SA 4.0", "u": "https://…" }
```

`a` autor, `l` licencia, `u` enlace a la fuente. **Los tres son obligatorios**: sin
ellos la foto no debe publicarse. Solo licencias que permitan uso comercial
(CC0, CC BY, CC BY-SA). NonCommercial y NoDerivatives no valen.

---

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:8899/`. En otra terminal:

```bash
npm run verify
```

Carga la web en un Chrome sin ventana y comprueba de verdad qué llega: peso de la
primera carga, errores de consola, si las fichas pintan, si el mapa tiene costa y si
la ficha de una especie con riesgo muestra su aviso. Acepta una URL:

```bash
npm run verify -- https://tu-dominio.com/
```

### Scripts de mantenimiento

| Comando | Qué hace |
|---|---|
| `npm run fichas` | Funde `scripts/content/*.json` en `species.json` y **falla** si un texto se repite, se sale de las 15–45 palabras o una especie peligrosa no declara riesgo |
| `npm run assets` | Marca las especies reportables a REDPROMAR y regenera favicon, iconos PWA y la tarjeta de Open Graph desde el logotipo |
| `npm run mapa` | Regenera la costa de `isla.json` desde OpenStreetMap |
| `npm run extract` | Reextrae datos y fotos del prototipo `artifact/` |

---

## Qué hay que saber antes de tocar nada

- **El contenido biológico es borrador.** Está escrito para que Agustín lo valide
  especie por especie. La web lo declara visiblemente y así debe seguir hasta que
  esa revisión exista.
- **24 especies tienen presencia local por confirmar y 5 probablemente no están en
  Canarias.** Salen marcadas *Por confirmar*. No las quites de la lista: quitarlas
  esconde el trabajo pendiente.
- **Nunca una especie con la foto de otra.** Sin coincidencia exacta de nombre
  científico, se deja la lámina generada y el rótulo *Foto pendiente*. Hoy son 3.
- **Horarios y precios no se guardan aquí.** Un horario caducado en una web de buceo
  destruye la confianza que la guía intenta construir. Se enlaza al operador.
- **Esta web no es documentación de seguridad de buceo.** No sustituye al briefing
  del centro ni a la información oficial de navegación o meteorología.
- **Sin secretos en el repositorio.** No hay variables de entorno; si algún día hacen
  falta, van en el panel de Vercel y nunca en el código.

---

## Prototipo de referencia

`artifact/fauna-el-hierro.html` es el artefacto original de 4,4 MB con todo
incrustado en base64. Ya no es el producto: se conserva congelado como referencia.
El producto es `public/`.

## Créditos y licencias

- Fotografía: Wikimedia Commons, solo licencias de uso comercial, con autor y enlace
  visibles en cada ficha y en la sección de créditos.
- Costa de El Hierro: OpenStreetMap, ODbL.
- Límites de la Reserva Marina y puntos de inmersión: Ministerio de Agricultura,
  Pesca y Alimentación, y Turismo de El Hierro.
- Taxonomía verificada en WoRMS.
