# Gym Companion — CLAUDE.md

## Descripción del proyecto

**Gym Companion** es una PWA (Progressive Web App) en español para seguimiento personal de gimnasio. Permite registrar entrenamientos, métricas de rendimiento, visualizar progreso y sincronizar datos con GitHub. Sin frameworks — vanilla JS puro.

## Caso de uso real (muy importante para dimensionar soluciones)

- **Un único usuario** (el dueño del repo) y **un único dispositivo activo**: su móvil con la PWA instalada.
- El usuario **de vez en cuando edita `db.json` directamente en GitHub** (desde la web). No hay otros editores ni otros dispositivos en paralelo.
- **Requisito innegociable**: la sincronización con GitHub debe funcionar siempre y **nunca perder datos** — ni los del móvil ni los editados a mano en GitHub.

**Implicaciones para el diseño**:

- No hay concurrencia real entre dispositivos. No diseñar para multi-device, multi-usuario, colaboración ni merges tipo CRDT.
- El único "conflicto" plausible es: móvil con cambios locales + GitHub editado a mano entre medias. La política actual (local es fuente de verdad al arrancar, modal de conflicto si el PUT devuelve 409/422) es adecuada.
- Preferir **soluciones simples y obvias** sobre abstracciones genéricas. Si una solución parece que necesita un sistema de sync sofisticado, casi seguro estamos sobrediseñando.
- Sí es aceptable añadir chequeos de seguridad baratos (p. ej. fetch de remote al arrancar para poblar `githubSha` y evitar 422 espurios) — pero siempre cuestionando si aportan valor real al flujo de un único usuario.

## Despliegue

- **Producción**: GitHub Pages (HTTPS) — rama `master`, raíz del repo
- **Local**: requiere servidor HTTP (VS Code Live Server, `npx serve`, `python -m http.server`). Abrir `index.html` directamente con `file://` no funciona — el Service Worker y `fetch('./db.json')` requieren HTTP/HTTPS.

## Arquitectura

```
index.html    → Estructura HTML: vistas (Hoy, Historial, Gráficas, Ajustes) + login
app.js        → Toda la lógica de la app
index.css     → Dark theme con glassmorphism, variables CSS, mobile-first
db.json       → BD por defecto: ejercicios (~100), rutinas; también archivo de sync con GitHub
manifest.json → Config PWA
sw.js         → Service Worker (cache network-first, omite GitHub API) — versión gym-companion-v2
```

## Stack técnico

- **Frontend**: Vanilla JS + CSS3 (sin frameworks)
- **Charts**: Chart.js v4.4.7 + date-fns adapter
- **Storage**: localStorage (primario) + GitHub REST API v3 (sync opcional)
- **PWA**: Service Worker + Web Manifest

## Estructura de datos (db.json)

```javascript
{
  exercises: { [id]: { id, name } },          // ~100 ejercicios en español
  routines: { DIA1: [...ids], DIA2: [...ids], DIA3: [...ids] },
  history: [{ date, type, completed, logs: [{ exercise_id, name, series, reps, weight }] }]
}
```

## Funcionalidades clave

- **Entrenamiento**: Rutinas Día 1 / Día 2 / Día 3, registro por series (reps reales vs esperadas), detección de PRs
- **Métricas**: Volumen (peso × series × reps_avg), e1RM (peso × (1 + reps_avg/30))
- **Historial**: Filtro por tipo de rutina, detalle expandible
- **Gráficas**: Volumen, Peso, e1RM con Chart.js, selector de ejercicio y rango de fechas
- **Sync GitHub**: PUT API con token PAT cifrado (XOR + contraseña), auto-save con debounce 500ms

## UX / Diseño

- Dark mode, acento azul `#569cd6`
- Mobile-first, safe area insets (notches)
- Bottom tab navigation, modales, toast notifications
- Animaciones: fade-up, bounce en badges de PR

## Convenciones de código

- Funciones en camelCase (`startWorkout`, `renderHistory`)
- IDs de ejercicios en snake_case (`curl_de_biceps_mancuerna`)
- Estado global en objeto `state` dentro de `app.js`
- Persistencia siempre vía `saveData()` → localStorage + GitHub sync
- `DB` es la variable global con toda la BD en memoria

## Tests

**Toda funcionalidad nueva DEBE llevar tests exhaustivos asociados.** No se considera terminado un cambio si no tiene tests que cubran:

- Casos normales (happy path)
- Casos borde (vacíos, nulls, límites, valores negativos)
- Regresiones (que lo anterior sigue funcionando)

Si la funcionalidad es lógica pura → tests unitarios en `tests/unit/`. Si involucra DOM/interacción → tests E2E en `tests/e2e/`. Idealmente ambos.

## Filosofía de cambios

**Antes de modificar código, consultar al usuario** si hay más de una forma razonable de resolver el problema. Preferir la solución correcta sobre la rápida.

- Leer y entender el código afectado antes de proponer cualquier cambio.
- Si hay dudas sobre el enfoque, exponer las opciones con sus pros/contras y preguntar.
- No hacer cambios colaterales no pedidos (refactors, limpieza, renombrados) aunque parezcan mejoras.
- Un fix rápido que no entiende la causa raíz es peor que tardar más en dar la solución correcta.

## Versionado

La app tiene una `APP_VERSION` en [app.js](app.js) (formato semver `major.minor.patch`). El bump se hace **a mano**, no por hooks.

- **Cuándo bumpear**: al finalizar un plan (`.aiplans/*.md` marcado como completado), cuando el usuario lo pida explícitamente, o si no ha habido plan, cuando se vaya a hacer un commit.
- **Procedimiento**: Claude DEBE preguntar al usuario si quiere incrementar la versión antes de hacerlo. Si acepta, editar `APP_VERSION` en `app.js` (normalmente `+1` en patch) e incluir el bump en el commit del cambio.
- **No existen hooks de versionado** — si aparece un `.hooks/pre-push` que bumpea versión, eliminarlo: dejaba commits colgando en local y causaba divergencias con la sync del PWA.

## Commits

**Al terminar cada cambio, Claude DEBE preguntar al usuario si quiere hacer commit.** Si el usuario acepta, Claude crea el commit con un mensaje descriptivo.

### Formato del mensaje de commit

```
<verbo en infinitivo>: <qué se hizo> — <por qué o efecto>

Ejemplos correctos:
  fix: corregir decodificación UTF-8 en loadDBFromGitHub — los tildes se mostraban como Ã³
  feat: añadir filtro por rango de fechas en vista Gráficas
  refactor: extraer lógica de PR detection a función propia
  fix: evitar parpadeo al actualizar series durante entreno activo

Ejemplos incorrectos (no usar):
  Auto-commit: app.js — 1 file changed, 2 insertions(+)
  update app.js
```

### Procedimiento

1. Terminar el cambio pedido por el usuario.
2. Preguntar: "¿Hacemos commit?" (proponer el mensaje).
3. Si acepta, hacer `git add` de los archivos relevantes y commit con el mensaje acordado.
