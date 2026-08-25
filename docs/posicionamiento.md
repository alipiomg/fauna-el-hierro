# Plan de posicionamiento — que a Agustín lo contraten

**Fecha:** 2026-08-25
**Para:** Agustín Fragero Blesa y Alipio
**Horizonte:** 90 días desde la publicación

---

## 1. La única métrica que importa

**Buceadores que contactan con Agustín y acaban buceando con él.**

Todo lo demás —visitas, tiempo en página, fichas consultadas, seguidores— solo
sirve si explica por qué esa cifra sube o baja. Una guía con diez mil visitas y
cero contactos ha fracasado; una con doscientas visitas y seis inmersiones
vendidas ha funcionado.

Esto tiene una consecuencia incómoda: **si Agustín no lleva la cuenta de cuántos
clientes llegan por la web, el plan no se puede evaluar**. Ese registro es la
pieza más barata y la más fácil de olvidar.

---

## 2. El embudo, con su medición

| # | Paso | Métrica | Cómo se mide | Estado hoy |
|---|---|---|---|---|
| 1 | Alguien llega a la guía | Visitantes únicos por semana | Analítica sin cookies | **No medible** |
| 2 | Encuentra valor | % que abre al menos una ficha de especie | Evento en el botón *Ver ficha completa* | **No medible** |
| 3 | Llega al autor | % que ve la sección *Bucear con Agustín* | Evento de visibilidad de `#autor` | **No medible** |
| 4 | Contacta | Clics en el botón de contacto | Evento de salida en el enlace | **No medible** |
| 5 | **Bucea con él** | Inmersiones vendidas atribuidas a la web | **Pregunta directa de Agustín** | **Medible ya** |

### Por qué cuatro de cinco no se miden

El extra de **analítica respetuosa** (Vercel Analytics o Plausible, sin cookies ni
banner) estaba en la lista de mejoras y **no se activó**. Sin él, los pasos 1 a 4
son invisibles: la web no manda ni un dato a ninguna parte.

Es una decisión defendible —menos dependencias, cero rastreo— pero hay que asumir
lo que cuesta: **optimizar el posicionamiento a ciegas es adivinar**. Si en la
revisión de los 30 días el paso 5 no se mueve, no habrá forma de saber si el
problema es que no llega nadie, que llega y se va, o que llega y no contacta.

**Recomendación:** activar Vercel Analytics. Es una línea en el `index.html`, no
usa cookies, no necesita banner de consentimiento y en plan Hobby es gratis.
Hasta entonces, el paso 5 se mide a mano.

### El paso 5, que sí se puede medir desde mañana

Agustín pregunta a cada cliente nuevo: **«¿cómo me has encontrado?»** y anota la
respuesta en tres categorías: *la web*, *Instagram*, *el centro de buceo / boca a
boca*. Una libreta basta. Sin esto no hay plan que valga.

---

## 3. Objetivos a 90 días

No hay línea base: la web se publica hoy. Estas cifras son **hipótesis de
trabajo**, para sustituir por datos reales en la primera revisión.

| Métrica | A 30 días | A 90 días | Cómo se sabrá |
|---|---|---|---|
| Clientes que dicen «te encontré por la web» | 1 | 5 | Libreta de Agustín |
| Visitantes únicos / semana | 40 | 150 | Analítica (pendiente) |
| Contactos iniciados / mes | 3 | 12 | Analítica (pendiente) |
| Fichas validadas por Agustín | 30 de 120 | 120 de 120 | Contar en `species.json` |
| Fotografías propias sustituyendo a Commons | 5 | 25 | Contar en `photos.json` |

Las dos últimas no son de marketing: son las que convierten la guía en algo que
solo Agustín podría haber hecho. Una guía con fotos de Commons la puede copiar
cualquiera; una con las suyas del Mar de las Calmas, no.

---

## 4. Qué mueve cada paso

### Paso 1 — que lleguen

La guía hoy es **una sola URL**. Buscar *«qué peces hay en El Hierro»* no lleva
aquí, porque no hay una página por especie que Google pueda indexar. Esto se
decidió así (opción *seo* no ratificada en d3) y es el mayor techo del plan.

Lo que sí se puede hacer sin cambiar la arquitectura:

- **Instagram como motor principal.** Cada ficha exportada como lámina imprimible
  es una publicación lista. Una especie por semana, con el enlace a la guía en la
  biografía. El botón ya genera el PNG a 3072 px.
- **Los centros de buceo de La Restinga.** Que enlacen la guía como material de
  briefing. Les da valor sin costarles nada y a Agustín lo posiciona ante sus
  compañeros de trabajo, que es de donde salen la mitad de los encargos.
- **REDPROMAR y las redes de observadores.** 49 especies llevan botón de reporte.
  Participar en la red con citas reales pone el nombre de Agustín en un circuito
  donde la credibilidad se acumula.
- **El Cabildo y Turismo de El Hierro.** La guía enlaza sus fichas oficiales en
  cada sección. Pedir el enlace de vuelta es razonable y gratis.

### Paso 2 — que encuentren valor

Ya funciona: 120 especies, tres niveles de texto, filtros por grupo y por
profundidad. El riesgo aquí no es de producto sino de credibilidad: **el aviso de
borrador está en la web y debe seguir hasta que Agustín valide**. Quitarlo antes
sería mentir; dejarlo un año sería admitir que el proyecto se paró.

### Paso 3 — que lleguen al autor

Hay tres entradas a `#autor`: botón del hero, menú y enlace desde la sección de
inmersiones. Es suficiente. **No añadir más llamadas** hasta poder medir si las
actuales funcionan.

### Paso 4 — que contacten

Aquí está el punto más débil del plan: **solo hay Instagram**.

Un buceador alemán planificando un viaje en enero no manda un DM: manda un correo
o un WhatsApp. Añadir ambos en `autor.json` es trabajo de cinco minutos y
probablemente el cambio con mejor retorno de toda esta lista.

### Paso 5 — que compren

Fuera del alcance de la web. Depende de Agustín, de su disponibilidad y de su
acuerdo con los centros de La Restinga.

---

## 5. Los tres techos conocidos

1. **Una sola URL.** Sin página por especie no hay tráfico de búsqueda. Levantarlo
   significa volver sobre la decisión d1 y generar rutas estáticas por ficha.
2. **Sin analítica.** Cuatro de las cinco métricas no existen.
3. **Solo español.** El buceo en El Hierro es turismo internacional y el extra de
   inglés y alemán no se activó. Los nombres científicos ya son universales; el
   resto de la interfaz no.

Ninguno es un fallo de ejecución: los tres son consecuencia directa de decisiones
tomadas a conciencia. Se documentan aquí para que la próxima revisión sepa qué
palancas quedan sin usar.

---

## 6. Cadencia

- **Semana 1:** Agustín empieza la libreta de «¿cómo me has encontrado?».
- **Día 30:** revisión de las cinco métricas. Si el paso 5 sigue a cero y no hay
  analítica, se activa antes de tocar nada más.
- **Día 90:** decidir con datos si merece la pena levantar el techo 1 (página por
  especie) o si el canal real es Instagram y los centros de buceo.
