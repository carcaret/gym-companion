# Bug 2: Historial — botones siempre visibles y reps incompletas

## Síntomas reportados

1. Al abrir el detalle de un día en Historial, los botones +/− de peso y series son visibles aunque no se haya pulsado editar.
2. Las reps muestran sólo una lista CSV de las reps reales (ej: `8, 10, 9`), sin mostrar las reps objetivo.
3. Al pulsar editar, no aparecen nuevos controles (el usuario esperaba que editar revelase más opciones).

## Causa raíz

### 1. Botones +/− siempre en el DOM (HistorialView.tsx:122-136)

El código renderiza los botones incondicionalmente:
```tsx
<button className="btn-icon" onClick={() => updateExerciseParam(...)}>−</button>
{editing ? <input ... /> : <span>{log.weight}</span>}
<button className="btn-icon" onClick={() => updateExerciseParam(...)}>+</button>
```

Los botones están siempre presentes, y sólo el campo de valor cambia entre `<input>` y `<span>`. No hay ningún CSS que oculte los botones fuera del modo edición (`.card-body.editing` sólo controla `max-height` y `overflow`, no visibilidad de botones).

### 2. Fila de reps sin contexto (HistorialView.tsx:138-141)

```tsx
<div className="param-row">
  <label>Reps</label>
  <span>{log.reps.actual.filter((r) => r !== null).join(', ') || log.reps.expected}</span>
</div>
```

Sólo muestra el CSV de reps reales o el objetivo como fallback. No muestra ambos ni aclara cuál es objetivo y cuál real.

### 3. Modo edición no diferenciado visualmente

Al pulsar ✏️, el campo de valor pasa de `<span>` a `<input>`, pero los botones ya estaban visibles. El usuario no percibe diferencia entre modo vista y modo edición.

## Plan de corrección

### A. Hacer los botones +/− condicionales al modo edición

En cada `param-row` de peso y series, envolver los botones con `{editing && ...}`:

```tsx
<div className="param-row">
  <label>Peso</label>
  {editing && <button className="btn-icon" onClick={() => updateExerciseParam(entry.date, li, 'weight', -2.5)}>−</button>}
  {editing
    ? <input className="param-input" type="number" value={log.weight} onChange={(e) => updateExerciseParamDirect(entry.date, li, 'weight', Number(e.target.value))} />
    : <span className="param-input">{log.weight} kg</span>}
  {editing && <button className="btn-icon" onClick={() => updateExerciseParam(entry.date, li, 'weight', 2.5)}>+</button>}
</div>
```

Mismo patrón para la fila de Series.

### B. Mejorar display de reps

Cambiar la fila de reps para mostrar objetivo y promedio real:

```tsx
<div className="param-row">
  <label>Reps</label>
  <span className="param-input">
    obj: {log.reps.expected}
    {log.reps.actual.some((r) => r !== null) && (
      <> · real: {log.reps.actual.filter((r) => r !== null).join(', ')}</>
    )}
  </span>
</div>
```

### C. Añadir función `updateExerciseParamDirect` para edición directa por input

Para que el input del campo editable funcione (actualmente usa `onChange={() => {}}` vacío):
```typescript
function updateExerciseParamDirect(entryDate: string, exerciseIdx: number, field: 'weight' | 'series', value: number) {
  onUpdateDB((d) => ({
    ...d,
    history: d.history.map((h) => {
      if (h.date !== entryDate) return h
      const logs = h.logs.map((log, i) => {
        if (i !== exerciseIdx) return log
        if (field === 'weight') return { ...log, weight: Math.max(0, value) }
        return { ...log, series: Math.max(1, value) }
      })
      return { ...h, logs }
    }),
  }))
}
```

## Archivos a modificar

- `src/presentation/features/history/HistorialView.tsx`
  - Condicionar botones +/− a `editing`
  - Mejorar display de reps (obj + real)
  - Corregir `onChange` de inputs en modo edición (actualmente vacío — bug secundario)

## Nota sobre edición de reps por serie

El historial no permite editar reps por serie individual (sólo peso y total de series). Esto es diferente del entreno activo (HoyView). Según la filosofía del proyecto, el historial es un registro, no un editor completo. Si el usuario quiere esta funcionalidad, se plantea como tarea separada.

## Sin cambios en

- CSS (no es necesario añadir reglas para ocultar botones)
- Lógica de `updateExerciseParam` con delta (sirve para los botones)
- Estructura de tarjetas (`.card`, `.card-header`, `.card-body`)
