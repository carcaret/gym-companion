# Bug 1: Hoy — vista previa muestra lista en bullet point

## Síntomas reportados

Cuando el usuario entra en la pestaña "Hoy" y selecciona un día (o el día es de rutina), ve una lista `<ul>/<li>` con los nombres de los ejercicios. No aparecen: peso, series objetivo, reps objetivo, botones +/− ni la interfaz de registro.

## Causa raíz

**Dos problemas independientes:**

### 1. Estado preview usa `<ul>/<li>` sin estilo (HoyView.tsx:179-197)

El estado "preview" (cuando `effectiveDay` está seleccionado pero aún no se ha iniciado el entreno) renderiza:

```tsx
<ul>
  {previewExercises.map((name, i) => <li key={i}>{name}</li>)}
</ul>
```

Esto produce una lista nativa del navegador con bullets y sin estilos del tema. La intención debería ser mostrar los ejercicios de la rutina con los últimos valores conocidos (peso, series, reps), para que el usuario vea qué le espera antes de pulsar "Iniciar entreno".

### 2. Las tarjetas del entreno activo empiezan colapsadas

Cuando se inicia el entreno, `expandedCards` empieza como `new Set()` vacío. El usuario ve las tarjetas cerradas (sólo el header con el nombre) y tiene que pulsar cada una para expandirla y ver/editar series y reps.

## Plan de corrección

### A. Reemplazar `<ul>/<li>` del preview por items estilizados con datos previos

En `HoyView.tsx`, en el bloque `{effectiveDay && !todayEntry && (...)}`:

1. Cambiar `previewExercises` (array de nombres) por un array de objetos con últimos valores conocidos, reutilizando la lógica de `getLastValues` que ya existe dentro de `startWorkout()`.

2. Extraer `getLastValues` como función del componente (fuera de `startWorkout`), para poder usarla también en el preview.

3. Reemplazar `<ul>/<li>` por divs estilizados. Cada ejercicio del preview mostrará:
   - Nombre del ejercicio
   - Peso último conocido (o 0kg si es nuevo)
   - Series × reps objetivo (o valores por defecto 3×10)

   Usar clases CSS ya existentes: `.exercise-row`, `.exercise-name`, `.meta-pill` dentro de un `.card`.

### B. Auto-expandir todas las tarjetas al iniciar el entreno

En `startWorkout()`, después de crear el `entry`, llamar a:
```tsx
setExpandedCards(new Set(logs.map((_, i) => i)))
```
Así todas las tarjetas empiezan expandidas y el usuario puede ver y editar directamente.

## Archivos a modificar

- `src/presentation/features/workout/HoyView.tsx`
  - Extraer `getLastValues` como función del componente
  - Reemplazar preview `<ul>/<li>` con items estilizados
  - En `startWorkout()`: inicializar `expandedCards` con todos los índices

## Código compartible con Bug 2

La lógica de mostrar ejercicios con peso/series/reps en modo lectura se puede unificar con los items del Historial (Bug 2). El patrón `.exercise-row > .exercise-name + .meta-pill` ya está en el CSS y se puede reusar en ambos.

## Sin cambios en

- CSS (clases existentes son suficientes)
- Lógica de `startWorkout()` en sí (sólo añadir el `setExpandedCards`)
- `ExerciseCard` (componente ya correcto para el entreno activo)
