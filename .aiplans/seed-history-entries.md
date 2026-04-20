# Plan: Limpieza de entradas semilla en el historial

**Estado**: 🟡 Propuesto — bajo coste, baja prioridad

## Contexto

En [db.json](../db.json) hay tres entradas al inicio del historial que son **semillas** (datos iniciales introducidos al arrancar la app, no entrenos reales):

- `2024-09-23` — DIA1
- `2024-09-25` — DIA2
- `2024-09-27` — DIA3

Características comunes:

- Todos los logs tienen `weight: 0`
- Todos los logs tienen `reps.actual: []` (vacío — nunca se completó ninguna serie)
- Están marcadas `completed: true`

Estructura típica:

```json
{
  "exercise_id": "elevaciones_laterales_con_mancuernas",
  "series": 3,
  "reps": { "expected": 12, "actual": [] },
  "weight": 0
}
```

## Por qué importan

`getLastValuesForExercise` ([src/data.js:24-41](../src/data.js#L24-L41)) busca en el historial la última ocurrencia del ejercicio y devuelve sus valores. Si un ejercicio **solo** aparece en una de estas entradas semilla (caso observado: `elevaciones_laterales_con_mancuernas`), la función devolverá `weight: 0`, `repsActual: []` — datos correctos según la BD pero inútiles como sugerencia para el siguiente entreno.

Síntoma real: tras quitar y re-añadir un ejercicio a mitad de entreno, aparece con peso 0 porque su única ocurrencia histórica está en la semilla.

## No urgente

- Mientras el ejercicio tenga al menos una ocurrencia "real" más reciente, el lookup la encuentra y las semillas no estorban.
- Actualmente solo afecta a ejercicios cuya única aparición está en una semilla. Poco frecuente.
- El usuario puede arreglar el valor manualmente en el momento.

## Opciones de resolución

### Opción 1 — Borrar las tres entradas semilla

Más simple. Editar `db.json` directamente y eliminar `history[0..2]`. Revisar antes que no haya ningún ejercicio cuya única ocurrencia esté en ellas — si lo hay, ese ejercicio se quedará "sin historial" (pero eso ya es lo que el usuario espera en esos casos).

**Pros**: resuelve el problema de raíz, un commit pequeño, no añade código.
**Contras**: requiere auditoría previa para saber qué ejercicios "pierden" su única referencia.

### Opción 2 — Filtrar en `getLastValuesForExercise`

Ignorar logs donde `reps.actual` esté vacío o todo-null al buscar "última vez". Si no hay ninguna con datos reales, caer a defaults.

**Pros**: no toca datos históricos, robusto frente a futuras semillas.
**Contras**: cambia el contrato de la función, hay que actualizar tests, añade heurística donde no tiene por qué haberla si se limpian los datos.

## Recomendación

**Opción 1** si el usuario confirma que ninguno de los ejercicios afectados le duele perder.

## Auditoría previa a ejecutar

Antes de borrar, listar los `exercise_id` cuya **única** ocurrencia está en `history[0..2]`:

```bash
# pseudo: para cada exercise_id de history[0..2], contar cuántas veces aparece en history[3..]
```

Si la lista está vacía o es irrelevante (ejercicios que el usuario no usa), borrar. Si incluye ejercicios activos, plantear Opción 2.

## Relación con otros casos

- Detectado al investigar el caso de `elevaciones_laterales_con_mancuernas` con peso 0 tras re-añadir a mitad de entreno (ver contexto en historial de conversación).
- Independiente del bug de `showCreateExerciseModal` no añadiendo log al entry activo (ese se trata aparte).
