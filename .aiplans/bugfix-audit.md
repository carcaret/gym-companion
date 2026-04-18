# Plan: Corrección de bugs detectados en auditoría

## Bugs ordenados por criticidad

---

### BUG 1 — CRÍTICO: Auto-login no permite sincronizar con GitHub

**Problema**: Tras auto-login (sesión guardada), `currentPassword` queda vacío. `getDecryptedPat()` necesita la contraseña para descifrar el PAT → devuelve `null` → toda sincronización con GitHub falla silenciosamente. El usuario no recibe feedback de que está trabajando solo en local.

**Archivo afectado**: `app.js` — `tryAutoLogin()` (línea ~187), `persistDB()` (línea ~111)

**Solución**:
1. Tras auto-login exitoso, si hay config de GitHub (`getGithubConfig()` no es null), mostrar un toast/banner: "Introduce tu contraseña en Ajustes para sincronizar con GitHub".
2. En `persistDB()`, cuando el PAT no se puede descifrar pero hay config de GitHub, mostrar toast "⚠️ Guardado local — contraseña necesaria para sincronizar".

**Tests**:
- Unit: verificar que `getDecryptedPat()` retorna null con password vacío
- E2E (`tests/e2e/session.spec.js`): auto-login con config GitHub guardada → se muestra aviso de sincronización pendiente
- E2E: tras auto-login sin password, al guardar un entreno → toast indica que no hay sync con GitHub
- E2E: tras introducir password en Ajustes → la sincronización funciona normalmente

---

### BUG 2 — ALTO: `getLastValuesForExercise` muta `DB.history` con `.sort()`

**Problema**: En `src/data.js:22` y `src/data.js:29`, se usa `.sort()` directamente sobre `db.history`, que muta el array original. Esto reordena el historial en memoria cada vez que se consulta.

**Solución (enfoque A — ordenar en origen)**:
1. **Garantizar invariante**: `DB.history` siempre ordenado por fecha ascendente.
2. **Puntos de inserción/modificación de history** (asegurar orden tras cada operación):
   - `startWorkout` en `app.js:457` — tras push, ordenar
   - `loadDBFromGitHub` / `loadDB` — tras cargar, ordenar
   - `getDefaultDB` — tras cargar, ordenar
   - `sync-github-btn` handler — tras asignar `DB = data`, ordenar
   - `test-github-btn` handler — tras asignar `DB = ok`, ordenar
3. **Crear función helper** `ensureHistorySorted(db)` en `src/data.js` que ordene `db.history` in-place por fecha ascendente.
4. **Cambiar los `.sort()` en `getLastValuesForExercise`** a copias (`[...arr].sort()`) como red de seguridad.
5. **Eliminar sorts redundantes** en `getLastValuesForExercise` si ya asumimos el invariante (o dejar con copia por seguridad).

**Tests**:
- Unit (`tests/unit/data.test.js`): `getLastValuesForExercise` NO muta el array original
- Unit: `ensureHistorySorted` ordena correctamente arrays desordenados
- Unit: `ensureHistorySorted` con array vacío, un elemento, ya ordenado
- Unit: tras `startWorkout`, `DB.history` sigue ordenado
- E2E: cargar DB con historial desordenado → queda ordenado después de login

---

### BUG 3 — MEDIO: Al añadir series con +, nuevas reps son `null` en vez de `reps.expected`

**Problema**: En `src/log-mutations.js:18`, `adjustLogParam` hace `log.reps.actual.push(null)` al incrementar series. Debería usar `log.reps.expected` para que las nuevas series tengan un valor útil por defecto.

**Archivo afectado**: `src/log-mutations.js` — `adjustLogParam()` (línea 18)

**Solución**: Cambiar `log.reps.actual.push(null)` por `log.reps.actual.push(log.reps.expected)`.

**Misma revisión en `setLogParam`** (línea 40): `while (log.reps.actual.length < newSeries) log.reps.actual.push(null)` → cambiar `null` por `log.reps.expected`.

**Tests**:
- Unit (`tests/unit/log-mutations.test.js`): incrementar series → nueva rep es `reps.expected`
- Unit: `setLogParam` con series mayor → nuevas reps son `reps.expected`
- Unit: decrementar series y volver a incrementar → nuevo valor es `reps.expected`
- E2E: durante entreno activo, pulsar + series → la nueva serie muestra el valor esperado, no vacío
- E2E: en edición de historial, pulsar + series → misma verificación

---

### BUG 4 — MEDIO: `completedDismissed` — simplificar vista de entreno completado

**Problema**: `completedDismissed` es una variable en memoria que no persiste tras recargar. Esto causa que el resumen del entreno completado reaparezca al recargar.

**Decisión**: Eliminar `completedDismissed` y el botón "Cerrar". Si el entreno del día está finalizado, la pestaña Rutinas siempre muestra el resumen del día completado. Sin botón para "escapar".

**Archivos afectados**: `app.js` — `renderHoy()` (línea ~348), `renderCompletedToday()` (línea ~612)

**Solución**:
1. Eliminar variable `completedDismissed` (línea 857).
2. En `renderHoy()`, eliminar la condición `completedDismissed !== todayStr()` (línea 367).
3. En `renderCompletedToday()`, eliminar el botón "Cerrar" y su handler.
4. Simplificar: si `todayEntry.completed`, siempre render el resumen.

**Tests**:
- E2E (`tests/e2e/workout-completed-view.spec.js`): tras finalizar entreno → se ve resumen, no hay botón "Cerrar"
- E2E: recargar página tras entreno completado → sigue mostrando resumen (no selector de rutinas)
- E2E: verificar que las otras pestañas siguen funcionando normalmente

---

### BUG 5 — BAJO: Modal de crear ejercicio se cierra aunque el ejercicio ya exista

**Problema**: En `showModal()`, el handler del botón es `btn.onclick = () => { a.action(); hideModal(); }`. Si `action()` hace `return` (porque el ejercicio ya existe), `hideModal()` se ejecuta igualmente. El usuario pierde lo que escribió.

**Archivo afectado**: `app.js` — `showModal()` (línea ~38)

**Solución**: Cambiar `showModal` para que `action()` pueda devolver `false` para impedir el cierre:
```js
btn.onclick = () => { 
  const result = a.action(); 
  if (result !== false) hideModal(); 
};
```
Y en `showCreateExerciseModal`, hacer que la action devuelva `false` cuando el ejercicio ya existe:
```js
if (DB.exercises[id]) { toast('...'); return false; }
```

**Tests**:
- Unit: `showModal` con action que devuelve `false` → modal sigue abierto
- E2E: abrir modal crear ejercicio → escribir nombre de ejercicio existente → pulsar "Crear y añadir" → toast de error → modal sigue abierto
- E2E: abrir modal crear ejercicio → escribir nombre nuevo → pulsar "Crear y añadir" → modal se cierra → ejercicio creado

---

## Orden de implementación

```
BUG 2 → invariante de orden (afecta a datos, base para el resto)
BUG 3 → reps.expected en nuevas series (fix simple, alto impacto UX)
BUG 4 → simplificar completedDismissed (eliminar código)
BUG 5 → modal no cierra si action falla (fix simple)
BUG 1 → feedback auto-login sin GitHub sync (requiere más UI)
```

Razón del orden: BUG 2 es un problema de integridad de datos que afecta a varias funciones. BUG 3 y 4 son fixes concretos. BUG 5 es menor. BUG 1 requiere diseñar UI de feedback y se beneficia de que el resto ya esté estable.

---

## Archivos a modificar

| Archivo | Bugs |
|---|---|
| `src/data.js` | BUG 2: `ensureHistorySorted`, fix `.sort()` |
| `src/log-mutations.js` | BUG 3: `push(null)` → `push(reps.expected)` |
| `app.js` | BUG 1, 2, 4, 5: feedback sync, ordenar tras carga, eliminar completedDismissed, fix modal |
| `tests/unit/data.test.js` | BUG 2: tests de inmutabilidad y orden |
| `tests/unit/log-mutations.test.js` | BUG 3: tests de nuevas series |
| `tests/e2e/session.spec.js` | BUG 1: tests de feedback auto-login |
| `tests/e2e/workout-completed-view.spec.js` | BUG 4: tests sin botón Cerrar |
| `tests/e2e/routine.spec.js` | BUG 5: tests de modal crear ejercicio |

---

## Criterio de completitud

Cada bug se considera resuelto cuando:
1. El fix está implementado
2. Los tests unitarios asociados pasan
3. Los tests E2E asociados pasan
4. `npm test` completo pasa sin regresiones
5. Tests E2E completos pasan sin regresiones
