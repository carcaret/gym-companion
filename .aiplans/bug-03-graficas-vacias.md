# Bug 3: Gráficas — áreas visibles pero vacías

## Síntomas reportados

En la pestaña Gráficas se ven las áreas de los gráficos (contenedores con fondo y borde), pero están completamente vacías — sin líneas, datos ni ejes visibles.

## Causa raíz

### 1. Los gráficos sólo se crean cuando hay ejercicio seleccionado (GraficasView.tsx:51)

```typescript
if (!canvas1Ref.current || !canvas2Ref.current || !selectedExercise) return
```

El `selectedExercise` empieza como `''`. Mientras el usuario no elija un ejercicio del selector, el `useEffect` sale sin crear ningún Chart. Los contenedores `.chart-container` (con `min-height: 300px` y fondo de la card) son siempre visibles, dando la impresión de "áreas vacías".

Esto es comportamiento correcto, pero el usuario no recibe feedback de qué hacer.

### 2. Errores de Chart.js silenciados (GraficasView.tsx:94)

```typescript
} catch {
  // ignore chart errors when canvas is hidden
}
```

Si hay un error al crear el chart (por ejemplo, por un problema de dimensiones del canvas), se silencia. No hay forma de saber si hay un fallo real de renderizado.

### 3. Posible problema de dimensiones con `responsive: true`

Chart.js con `responsive: true` mide las dimensiones del canvas al crearse. El canvas se crea dentro de `.chart-container` (que tiene `min-height: 300px` pero no height explícita). Si el canvas se crea con width=0 por algún motivo de layout, el chart puede no pintarse.

## Plan de corrección

### A. Mostrar placeholder cuando no hay ejercicio seleccionado

Dentro de cada `.chart-container`, mostrar un mensaje cuando `selectedExercise` está vacío:

```tsx
<div className="chart-container">
  {!selectedExercise
    ? <p className="chart-placeholder">Selecciona un ejercicio para ver la gráfica</p>
    : <canvas id="chart-canvas" ref={canvas1Ref} />
  }
</div>
```

Esto evita mostrar un `<canvas>` vacío y da instrucciones al usuario.

### B. Auto-seleccionar el primer ejercicio con historial

Si `exercisesWithHistory` tiene elementos, inicializar `selectedExercise` con el primero:

```typescript
const [selectedExercise, setSelectedExercise] = useState(() => '')

// En el useEffect o useMemo que calcula exercisesWithHistory:
useEffect(() => {
  if (!selectedExercise && exercisesWithHistory.length > 0) {
    setSelectedExercise(exercisesWithHistory[0].id)
  }
}, [exercisesWithHistory])
```

Así si el usuario tiene historial, verá una gráfica al entrar directamente.

### C. Fijar dimensiones del canvas para evitar problemas responsive

Añadir `maintainAspectRatio: false` a las opciones de Chart.js y dar height explícita al canvas (o al container), para garantizar que Chart.js siempre tiene dimensiones válidas:

```typescript
options: {
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  scales: { x: { type: 'time' } }
}
```

Y en CSS dar al `.chart-container` una `height` explícita (ej: `height: 220px`) además del `min-height`.

### D. Añadir estilos para el placeholder

En `index.css`, añadir:
```css
.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 220px;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
}
```

## Archivos a modificar

- `src/presentation/features/charts/GraficasView.tsx`
  - Placeholder cuando no hay ejercicio
  - Auto-selección del primer ejercicio
  - Opción `maintainAspectRatio: false`
- `index.css`
  - Añadir `.chart-placeholder`
  - Añadir `height` explícita a `.chart-container`

## Sin cambios en

- Lógica de cálculo de datos (computeVolume, computeE1RM)
- Registro de plugins de Chart.js
- Controles de fecha y tipo de gráfica
