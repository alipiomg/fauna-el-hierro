# Sistema de prompts — completar las fichas infográficas

**Proyecto:** Fauna Marina de El Hierro · Agustín Fragero Blesa
**Objetivo concreto:** rellenar los cuatro bloques que hoy faltan en la ficha de cada
especie, más la distribución y los rasgos de identificación, para las 120 especies.

---

## 0. Antes de conectar nada: qué herramienta hace qué

**No uses un modelo texto-a-imagen para generar estas láminas.** Ni Flux, ni Midjourney,
ni Nano Banana, ni Recraft. La lámina de referencia contiene nombre científico y autoridad
exactos, cifras precisas de talla y profundidad, una fotografía real del animal, un mapa
de El Hierro y un QR funcional. Un modelo de imagen deforma el texto, inventa los números,
no puede insertar una fotografía real ni un QR que funcione.

Generar 120 láminas así produce 120 piezas de desinformación verosímil firmadas por un
profesional en ejercicio. Es el peor resultado posible para este proyecto.

La separación correcta:

| Capa | Herramienta | Estado |
|---|---|---|
| Maquetación de la ficha | HTML/CSS en el artefacto | **ya hecho** |
| Taxonomía y autoridad | API de WoRMS | **ya hecho**, 120/120 |
| Fotografía y licencia | Commons + iNaturalist | **ya hecho**, 117/120 |
| Texto biológico que falta | LLM por API/MCP | **esto es lo que sigue** |
| Lámina PNG imprimible | Chrome headless sobre el HTML | pendiente |

El LLM escribe; no dibuja. La maquetación es determinista: cambiar un color se hace una
vez en el CSS y se propaga a las 120 láminas.

---

## 1. Qué falta exactamente

La ficha ya tiene, por especie: `n` nombre común, `s` nombre científico aceptado,
`auth` autoridad, `ord` orden, `fam` familia, `syn` sinónimo si lo hubo, `b` banda de
profundidad, `loc` presencia local, `f` frecuencia, `sz` talla, `dp` profundidad,
`id` cómo reconocerla, `ha` hábitat, `be` comportamiento, `ex` nota de experto.

Faltan seis campos. Son los que dejan hueco en la columna derecha del modal:

| Campo | Bloque en la ficha | Nota |
|---|---|---|
| `food` | ALIMENTACIÓN | null si no aplica |
| `repro` | REPRODUCCIÓN | |
| `def` | DEFENSA | null en organismos sin defensa activa |
| `eco` | PAPEL ECOLÓGICO | |
| `dist` | DISTRIBUCIÓN | área global, no local |
| `marks` | rasgos con línea de llamada | 3–5 por especie |

---

## 2. Prompt maestro — genera el listado de encargos

Este es el que pediste: se ejecuta **una vez** y devuelve los 120 encargos individuales.

```text
Eres el coordinador de contenido de una guía de buceo profesional sobre la fauna marina
de El Hierro (Canarias, Reserva Marina del Mar de las Calmas).

Te doy un array JSON con las especies de la guía. Cada elemento trae:
i, n (nombre común), s (nombre científico aceptado), auth, ord, fam, g (grupo),
b (banda de profundidad), loc (si | dudosa | no), f (frecuencia), sz, dp

Devuelve un array JSON donde cada elemento es un ENCARGO listo para enviar a un modelo
de lenguaje, uno por especie, con esta forma exacta:

{
  "i": <número>,
  "especie": "<s>",
  "prompt": "<texto completo y autocontenido del encargo>"
}

Reglas para construir "prompt":

1. AUTOCONTENIDO. Quien lo reciba no verá este mensaje ni el array. Incluye dentro del
   prompt el nombre científico, el común, el grupo, la familia, la talla y la
   profundidad que ya conocemos, para que no los reinvente ni los contradiga.

2. Incorpora literalmente la PLANTILLA DE EXTRACCIÓN de la sección 3, con los valores
   ya sustituidos.

3. Si loc es "dudosa" o "no", añade al final:
   "ATENCIÓN: la presencia de esta especie en aguas de El Hierro NO está confirmada.
   Escribe dist como área de distribución conocida y no afirmes presencia canaria."

4. ADAPTA EL VOCABULARIO AL GRUPO. A un porífero no le preguntes por comportamiento de
   huida; a un briozoo no le preguntes por defensa activa; a un cetáceo no le preguntes
   por sustrato de fijación. Indica explícitamente en cada encargo qué campos es
   previsible que sean null para ese grupo concreto.

No escribas nada fuera del array JSON.
```

---

## 3. Plantilla de extracción — se ejecuta 120 veces

Lo importante de este prompt no es lo que pide, sino lo que prohíbe.

```text
Eres un biólogo marino redactando una ficha de campo para buceadores en El Hierro.
La ficha la firma un Dive Máster en ejercicio y se publica como material profesional:
un dato inventado es un error grave, no una imprecisión menor.

ESPECIE: {{s}} {{auth}} — "{{n}}"
GRUPO: {{g}} · FAMILIA: {{fam}} · ORDEN: {{ord}}
DATOS YA VALIDADOS, NO LOS CONTRADIGAS: talla {{sz}}, profundidad {{dp}},
frecuencia en El Hierro {{f}}.

Devuelve EXCLUSIVAMENTE este objeto JSON. Sin markdown, sin explicación, sin texto
antes ni después.

{
  "i": {{i}},
  "food":  string|null,   // Alimentación. 20-35 palabras.
  "repro": string|null,   // Reproducción. 20-35 palabras.
  "def":   string|null,   // Defensa. 20-35 palabras. null si no tiene defensa activa.
  "eco":   string|null,   // Papel ecológico concreto. 20-35 palabras.
  "dist":  string,        // Distribución GLOBAL. 20-30 palabras.
  "marks": [              // 3-5 rasgos para las líneas de llamada de la lámina
    {"label": string,     // "Dientes fusionados en pico"
     "part":  string}     // "boca" | "aleta dorsal" | "manto" | "ósculo" ...
  ],
  "iucn": string|null,    // "LC","NT","VU","EN","CR" solo si la especie está evaluada
  "risk": string|null,    // solo si hay riesgo real, con la actuación concreta
  "confidence": {
    "level": "alta"|"media"|"baja",
    "uncertain": [string] // nombres de los campos de los que no estás seguro
  }
}

REGLAS INNEGOCIABLES

1. NO INVENTES. Si no conoces un dato con seguridad razonable, null. Un null es un dato
   correcto; una frase plausible inventada es una mentira que alguien usará bajo el agua.

2. PROHIBIDO EL RELLENO GENÉRICO. Nada de "varía según la especie", "consulta la ficha
   científica", "forma parte de la red trófica". Si el texto podría aplicarse igual a
   otra especie del mismo grupo, no sirve: ponlo a null.

3. DISTINGUE ÁREA GLOBAL DE PRESENCIA LOCAL. `dist` es el área de distribución conocida.
   Nunca escribas en `dist` que la especie está en El Hierro salvo que te conste.

4. NUNCA cites un punto de inmersión concreto (El Bajón, Punta Restinga, La Caleta).
   Esos datos son de campo y los aporta el autor de la guía, no tú.

5. `risk` SOLO SI HAY RIESGO REAL: urticante, venenosa, espinas, mordedura. Y entonces
   con la actuación concreta. "Observa sin tocar" no es un riesgo, es una norma general
   y ya está en otro campo.

6. `marks` debe describir rasgos VISIBLES BAJO EL AGUA por un buceador con foco, no
   caracteres microscópicos ni de disección. Si el rasgo diagnóstico real solo se ve al
   microscopio, dilo en `confidence.uncertain`.

7. Español de España, registro técnico y legible. Sin superlativos de folleto
   ("impresionante", "fascinante", "espectacular criatura").

8. AUTOEVALUACIÓN HONESTA. `confidence.uncertain` con los campos reales de los que dudas.
   Declarar la duda es lo que hace utilizable este sistema.
```

---

## 4. Prompt de control de calidad — segunda pasada

Nunca publiques la primera salida. Este revisa por lotes de diez.

```text
Eres el revisor científico de una guía de buceo. Te doy fichas JSON generadas
automáticamente. Tu trabajo es DESCONFIAR.

Para cada una devuelve:

{
  "i": <número>,
  "veredicto": "publicable"|"revisar"|"rechazar",
  "problemas": [
    {"campo": string,
     "tipo": "dato_inventado"|"relleno_generico"|"presencia_local_no_justificada"
            |"riesgo_omitido"|"contradiccion_interna"|"rasgo_no_visible",
     "detalle": string}
  ]
}

Marca "rechazar" ante cualquiera de estas señales:

- Texto que podría aplicarse igual a cualquier otra especie del mismo grupo.
- `dist` afirmando presencia canaria sin respaldo.
- Especie urticante, venenosa o con espinas y `risk` a null. Revisa especialmente:
  cnidarios, gusanos de fuego, rayas con espina caudal, conos, erizos, escorpénidos.
- Contradicción entre bloques: defensa por camuflaje y a la vez coloración de
  advertencia; alimentación herbívora y dentición de depredador.
- `iucn` declarado en una especie que no está evaluada.
- Rasgos en `marks` que no se ven bajo el agua.

No corrijas las fichas. Solo diagnostica.
```

---

## 5. Cómo conectarlo por API o MCP

```
species.json
  → [prompt sección 2]  → encargos.json      (1 llamada)
  → [prompt sección 3]  → fichas/*.json      (120 llamadas, de 8 en 8 en paralelo)
  → [prompt sección 4]  → revision.json      (12 llamadas, lotes de 10)
  → revisión humana de "revisar" y "rechazar"
  → merge en SPECIES → republicar el artefacto
```

**Parámetros.** Temperatura 0–0.3 en la sección 3: esto es extracción de conocimiento,
no redacción creativa. Si la API admite salida estructurada (`response_format` con JSON
schema), úsala: elimina de golpe los errores de parseo.

**Coste.** La salida de la sección 3 ronda las 200 palabras por especie. 120 llamadas es
un lote barato. El prompt de la sección 4 es el que ahorra dinero de verdad, porque evita
rehacer trabajo ya publicado.

**Por MCP.** Expón `species.json` y `photos.json` como recursos de solo lectura, y una
herramienta que consulte WoRMS por nombre. Así el modelo comprueba el nombre aceptado y
si hay fotografía antes de redactar, en vez de suponerlo.

**Merge.** Los campos nuevos entran en cada entrada de `SPECIES` junto a `id`, `ha`, `be`
y `ex`. La ficha del artefacto ya tiene los huecos preparados en la columna derecha.

---

## 6. Único uso legítimo de un modelo de imagen

Para las especies **sin fotografía con licencia utilizable** — hoy `Spirobranchus
polytrema`, `Eunice roussaei` y `Raja maderensis` — una ilustración científica declarada
como tal. La lámina debe rotularla "Ilustración, no fotografía", igual que ahora rotula
"Foto pendiente".

```text
Ilustración científica de {{s}}, estilo lámina de historia natural del siglo XIX:
acuarela y tinta sobre fondo crema liso, vista lateral completa del animal, iluminación
neutra y uniforme, sin sombra proyectada, sin fondo marino, sin texto ni rótulos de
ningún tipo, sin marco.
Rasgos que deben verse con claridad: {{marks separados por comas}}.
Proporciones anatómicas correctas para un ejemplar de {{sz}}.
```

**Nunca la presentes como fotografía ni la uses para confirmar una identificación de
campo.** Una ilustración generada orienta la búsqueda; no prueba nada.
