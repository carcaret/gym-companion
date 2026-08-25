# Pestaña Estadísticas — diseño

Fecha: 2026-08-25
Estado: diseño aprobado, pendiente de plan de implementación

## Objetivo

Gráficas responde bien a "¿cómo va *este* ejercicio?", pero exige elegir un
ejercicio a mano —escribiendo su nombre en un buscador— y no agrega nada. No
puede contestar preguntas de conjunto: qué está estancado, cómo se reparte el
trabajo entre grupos musculares.

Estadísticas cubre ese hueco. Gráficas se queda como está, sin cambios más allá
de poder recibir un ejercicio ya seleccionado desde Estadísticas.

## Restricción de uso

El usuario consulta esta pestaña desde el móvil, a menudo entre series. La regla
que ordena todo el diseño:

- **Nunca hay que escribir.** Escribir es lo que hace incómoda la pestaña de
  Gráficas hoy.
- Tocar está bien, incluso varias veces.
- El nivel principal se lee scrolleando, sin tocar nada.

## Arquitectura: dos niveles

**Nivel 1 — el feed.** Lo que se ve al abrir la pestaña. Tarjetas que se
scrollean, sin selectores, sin campos de fecha, sin controles de rango. Todo
precalculado al renderizar. Cada tarjeta lleva su ventana temporal escrita en la
cabecera.

**Nivel 2 — drill-down.** Al tocar una fila. Ahí sí caben más interacciones.

No hay chip de rango global que afecte a todas las tarjetas: un rango único
empeora las dos tarjetas a la vez, porque cada una tiene su plazo natural.

Este reparto replica el patrón que ya usa `views/historial.js`
(`renderHistorial` → `renderHistorialDetail`).

## Tarjeta 1 — Ejercicios

Responde: *¿qué ejercicio no se está moviendo?*

### Contenido

Los 19 ejercicios de la rutina, uno por fila. Cada fila muestra:

1. Nombre del ejercicio
2. Peso actual
3. Reps reales de las **3 últimas sesiones**, tal cual se ejecutaron
4. Una frase descriptiva de qué ha pasado

Ejemplo con datos reales de agosto de 2026:

```
Press de Hombros con Mancuernas       18 kg
  11-11-10 · 11-11-10 · 11-11-10
  4 meses sin superar 32 reps

Curl Femoral Sentado                  97 kg
  9-9-9 · 9-9-9 · 9-9-9
  6 sesiones idénticas, ninguna rep fallada

Jalón al pecho neutro                 68 kg
  10-10-10-9 · 10-10-10-9 · 11-10-10-10
  38 → 41 reps al mismo peso

Prensa de Piernas                    240 kg
  12-12-12-12 · 10-10-10-10 · 8-9-9-9
  220 → 240 kg en tres semanas
```

### Reglas de contenido

- **Solo texto descriptivo.** Ni etiquetas de estado, ni recomendaciones, ni
  porcentajes. La tarjeta cuenta qué ha pasado; el usuario decide qué hacer.
- Las **reps mostradas** son las 3 últimas sesiones. La **frase** mira todo el
  histórico al peso actual: por eso puede decir "4 meses" aunque solo se pinten
  tres sesiones. Limitar la frase a la ventana escondería el dato que importa.
- **Orden:** primero los que llevan más tiempo sin moverse, al final los que
  progresan. La clave de ordenación es el **número de sesiones consecutivas, al
  peso actual, sin superar el mejor registro previo** (ni en peso ni en reps
  totales), de mayor a menor. Los que progresan tienen esa cuenta a 0 y caen al
  final; entre ellos, orden alfabético. Los ejercicios sin recorrido van al
  final del todo.
- **Ejercicio sin recorrido**: menos de 3 sesiones con reps registradas. Texto
  propio, "2 sesiones, aún sin recorrido", sin veredicto ni puesto en el orden.
  Con los datos actuales solo cae aquí Doninadas, con 2 sesiones.
- **Ejercicio sin peso** (Doninadas, `weight: 0`): solo reps, sin columna de kg.
  `getPrimaryMetric()` ya cae a volumen cuando no hay e1RM.

### Cómo se decide si un ejercicio se mueve

Un ejercicio progresa si, en la ventana de 8 semanas, se cumple alguna:

- El **peso máximo** ha subido, o
- El **máximo de reps totales al peso actual** ha mejorado.

Criterios descartados, cada uno por una razón medida sobre los datos reales:

- **Déficit contra `reps.expected`.** El objetivo es un número que el usuario
  teclea con los botones −/+, y lo sube según progresa. Jalón al pecho neutro
  falla el objetivo en 6 de 6 sesiones mientras sube de 38 a 41 reps a 68 kg:
  medido así saldría estancado, y está progresando. Es el mismo error que
  corrigieron 2.9.1 y 2.9.2.
- **Caída de la primera a la última serie** como señal de estar al límite. No
  vale: es el patrón normal de este usuario. Con 14 kg mantuvo `12-12-10`
  durante cinco meses mientras progresaba de 34 a 43 reps.
- **Delta de e1RM por debajo del 5%.** Los spreads normales entre sesiones son
  del 2 al 4%, así que por debajo del 5% es ruido. Con un umbral del 2%, cinco
  ejercicios salían como avanzando sin haberse movido.
- **Delta de e1RM a secas, sin mirar el peso.** Al subir carga bajan las reps y
  el e1RM se compensa casi exacto: Prensa pasó de 220 a 240 kg con un +1,3% de
  e1RM. Por eso la subida de peso cuenta como progreso por sí sola.

### Ventana

8 semanas para clasificar y ordenar. Coincide con el plazo que la literatura
sitúa como punto donde un estancamiento merece atención (4-8 semanas) y, a 3
sesiones por semana con cada ejercicio una vez por semana, con la ventana de 6
barras que ya usa el history strip.

### Drill-down

Tocar una fila abre **Gráficas con ese ejercicio ya seleccionado**. Reutiliza
una vista que ya existe y elimina el buscador por texto como única forma de
llegar a ella.

Gráficas muestra un botón "← Volver a Estadísticas" **solo** cuando se ha
llegado desde una fila, y al volver restaura la posición de scroll de la lista.

Implementación: `gym:navigate` ya lleva `detail`; se le añade el origen y el
scroll. Hoy `navigateToTab()` (`app.js:137`) hace `window.scrollTo(0, 0)`
siempre, así que hay que respetar el scroll guardado en el camino de vuelta.

Queda **fuera de alcance** enganchar el botón o gesto de atrás del móvil
(`history.pushState` + `popstate`): eso mete historial de navegación en las
cuatro pestañas y es un cambio de arquitectura aparte. Si más adelante hace
falta, se añade encima sin deshacer nada.

## Tarjeta 2 — Grupos musculares

Responde: *¿cómo se reparte mi trabajo entre grupos?*

### Contenido

Series por semana y grupo, últimas 8 semanas, en barras horizontales:

```
espalda   ████████████  11,2 series/semana
piernas   ███████████   10,9
pecho     █████████      9,0
hombros   █████████      9,0
brazos    █████          5,2
core      ██             2,2
```

- **Sin franja de referencia** contra la literatura. La tarjeta describe el
  reparto propio y no compara contra nada externo.
- **Series**, no volumen en kg·rep: el volumen premia lo que se carga pesado y
  hace incomparables los grupos entre sí (piernas 42.866 frente a pecho 6.474 en
  las mismas 4 semanas). Las series son además la unidad en que están escritas
  las recomendaciones publicadas.
- **Ventana de 8 semanas.** En 4 semanas cae el parón de 18 días y las cifras
  bajan por no haber ido, no por repartir distinto.

### Drill-down

Tocar un grupo despliega sus ejercicios con sus series por semana.

### Sesgo conocido, a documentar en el propio diseño

`brazos` y `core` están infracontados por construcción: la app solo cuenta
trabajo directo, y los bíceps ya reciben carga de las 11 series semanales de
espalda, los tríceps de las 18 de pecho más hombros. El número no es comparable
con el de los grupos que sí se entrenan de forma aislada.

### Prerrequisito

Cuatro ejercicios no tienen `grupo` asignado, y suman el 21,2% de las series.
Sin arreglarlos la tarjeta miente: `espalda` aparecía al 6,1% cuando en realidad
es el grupo con más volumen (11,2 series/semana).

| Ejercicio | Grupo |
|---|---|
| Jalón al pecho neutro | espalda |
| Doninadas | espalda |
| Trapecio polea | espalda |
| Curl bíceps polea | brazos |

**Pregunta abierta:** dónde se aplica el arreglo. La DB viva está en el
localStorage del móvil y en GitHub; el `db.json` del repo no es la fuente de
verdad. Hay que decidirlo antes de implementar.

Pedir el grupo al crear un ejercicio queda **fuera de alcance** de este diseño,
aunque sea la causa de raíz.

## Descartado, y por qué

- **Tarjeta de constancia / adherencia.** Mide si fuiste al gimnasio, no cómo
  entrenaste. El usuario no la quiere.
- **Tarjeta de récords.** 44 récords en 8 semanas, 2,4 por sesión: ruido. Y
  `detectRecords()` en `src/workout.js` ya los avisa durante el entreno.
- **Índice de progreso global.** El índice de e1RM normalizado por trimestre da
  1,46 → 1,31 → 1,56 → 1,37 sin que el usuario perdiera fuerza: mide qué
  ejercicios se hicieron ese mes, no el progreso. Necesitaría una cesta fija que
  se rompe cada vez que cambia la rutina.
- **Strip de barras en cada fila.** Los spreads reales entre sesiones son del 0
  al 4%, así que apilado en lista sale un muro de barras macizas idénticas. La
  altura discrimina dentro de una card de Hoy, no en una lista comparativa.
- **Etiquetas de estado** (ATASCADO / ACOMODADO / FORZANDO / PROGRESANDO). Si hay
  que explicar la diferencia entre dos etiquetas, la etiqueta no vale.
- **Recomendaciones** ("sube el peso", "baja el peso", "añade una serie"). La app
  no ve descanso, alimentación, estrés ni proximidad al fallo, que es lo primero
  que habría que mirar. Y no existen ensayos que comparen respuestas al
  estancamiento, así que cualquier receta sería inventada. Además, la evidencia
  del deload es floja: un ensayo con una semana de descarga a mitad de un
  programa de 9 semanas empeoró la fuerza del tren inferior sin mejorar la
  hipertrofia.
- **Chip de rango global** para todas las tarjetas. Cada tarjeta tiene su plazo
  natural; un rango único las empeora todas.

## Notas de datos

- El ejercicio "Doninadas" está así escrito en la DB. Parece una errata de
  "Dominadas"; corregirlo es decisión del usuario y no forma parte de esto.
- "Extensiones de Espalda" está clasificado como `core`. Lleva peso (de 20 kg en
  abril de 2025 a 36 kg hoy), así que sí tiene e1RM.

## Referencias

- [PeerJ — Gaining more from doing less? One-week deload during supervised resistance training](https://peerj.com/articles/16777/)
- [Sports Medicine Open — Deloading Practices in Strength and Physique Sports](https://link.springer.com/article/10.1186/s40798-024-00691-y)
- [Sports Medicine — The Resistance Training Dose Response: Meta-Regressions on Weekly Volume and Frequency](https://link.springer.com/10.1007/s40279-025-02344-w)
- [Schoenfeld et al. — Dose-response between weekly volume and muscle mass](https://pubmed.ncbi.nlm.nih.gov/27433992/)
- [Sports Medicine Open — Effect of Load and Volume Autoregulation on Strength and Hypertrophy](https://sportsmedicine-open.springeropen.com/articles/10.1186/s40798-021-00404-9)
- [Autoregulated resistance training for maximal strength: network meta-analysis](https://www.sciencedirect.com/science/article/pii/S1728869X25000590)
