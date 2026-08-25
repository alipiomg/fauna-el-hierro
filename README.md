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

## Lo que Agustín puede cambiar sin tocar código

Todo está en `public/data/`. Se editan desde GitHub: abrir el fichero, botón del
lápiz, guardar. Son JSON: respeta las comillas y las comas.

| Fichero | Qué contiene |
|---|---|
| `species.json` | Las 120 fichas: nombre, talla, profundidad, los cuatro bloques biológicos, avisos de riesgo |
| `photos.json` | Autoría y licencia de cada fotografía |
| `inmersiones.json` | Puntos de inmersión: profundidad, nivel, acceso, descripción |
| `viaje.json` | Cómo llegar y moverse: operadores, duraciones, alojamiento |
| `autor.json` | Biografía, canales de contacto y llamada a la acción |
| `isla.json` | Costa y límites del mapa. **No lo toques**: se genera con un script |

### Añadir un canal de contacto

En `autor.json`, dentro de `contacto`:

```json
{ "t": "WhatsApp", "v": "+34 600 000 000", "url": "https://wa.me/34600000000" }
```

El que lleve `"primario": true` es el que aparece como botón grande.

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
