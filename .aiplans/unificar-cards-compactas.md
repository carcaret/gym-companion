# Plan: Unificar estilo de cards de ejercicio al estilo "entreno activo"

## Contexto
El usuario prefiere el estilo compacto de las cards durante el entreno activo (`.card-header` + `.card-subtitle` con formato `3×8 · 50 kg`, sin iconos, sin pills, más ajustado al texto). Quiere que las cards de **pre-workout** (vista Hoy, antes de iniciar) y **historial detalle** (vista Historial, al entrar en un día) se vean igual.

Adicionalmente, quiere un formato inteligente de reps: `3x10` si todas iguales, `10-10-9` si difieren.

## Archivos a modificar
- `app.js` — funciones `renderRoutinePreview` (línea 464) y `renderHistorialDetail` (línea 1025)
- `index.css` — ajustes menores si es necesario

## Cambios

### 1. `renderRoutinePreview` (app.js:464-481)

**Antes:**
```html
<div class="card">
  <div class="exercise-row">
    <div class="exercise-name">Curl biceps</div>
    <div class="exercise-meta">
      <span class="meta-pill">📊 <strong>3</strong> series</span>
      <span class="meta-pill">🔄 <strong>10</strong> reps</span>
      <span class="meta-pill">🏋️ <strong>20</strong> kg</span>
    </div>
  </div>
</div>
```

**Después:** Usar `card-header` + `card-subtitle` (mismo HTML que entreno activo, sin chevron ni card-body):
```html
<div class="card compact-card">
  <div class="card-header">
    <div>
      <div class="card-title">Curl biceps</div>
      <div class="card-subtitle">3×10 · 20 kg</div>
    </div>
  </div>
</div>
```

### 2. `renderHistorialDetail` — modo lectura (app.js:1073-1088)

**Antes:** Mismo formato con meta-pills + botón editar.

**Después:** Mismo estilo compacto, manteniendo el botón editar como chevron/icono a la derecha:
```html
<div class="card compact-card historial-detail-card">
  <div class="card-header">
    <div>
      <div class="card-title">Curl biceps</div>
      <div class="card-subtitle">3×10 · 20 kg · Reps: 3x10</div>
    </div>
    <button class="btn-icon historial-edit-btn" data-logidx="0">✏️</button>
  </div>
</div>
```

### 3. Formato inteligente de reps

Crear helper para formatear reps:
- Si `reps.actual` tiene datos y todos son iguales: `3x10`
- Si `reps.actual` tiene datos y difieren: `10-10-9`
- Si no hay datos actual: usar `series×expected` (ej: `3×10`)

### 4. Formato del subtitle

**Pre-workout:** `{series}×{repsExpected} · {weight} kg` (o `Sin peso`)
- Ejemplo: `3×10 · 20 kg`

**Historial (lectura):** `{series}×{repsExpected} · {weight} kg · Reps: {formato_inteligente}`
- Ejemplo con reps iguales: `3×10 · 20 kg · Reps: 3x10`
- Ejemplo con reps diferentes: `3×10 · 20 kg · Reps: 10-10-9`
- Si no hay reps actual registradas, omitir la parte de "Reps:"

### 5. CSS — clase `.compact-card`

Añadir clase `.compact-card` para reducir padding igual que en entreno activo (las cards de entreno activo ya usan `.card` con padding 16px que es el mismo). Revisar si `.exercise-row` añade padding extra que deba eliminarse. En principio `.card-header` ya no tiene padding extra, así que debería verse igual.

Podría ser necesario:
- Quitar el `cursor: pointer` del `.card-header` en cards sin expand (o no, es inofensivo)
- No se necesitan cambios CSS si se usa exactamente el mismo markup que el entreno activo

## Verificación
1. Abrir la app en un servidor local
2. Ir a "Hoy", seleccionar un día -> las cards deben verse compactas sin iconos, formato `3×10 · 20 kg`
3. Iniciar el entreno -> las cards deben verse exactamente igual (ya están bien)
4. Ir a "Historial", entrar en un día -> cards compactas con botón editar, mostrando reps reales en formato inteligente
5. Verificar que el modo edición del historial sigue funcionando correctamente
