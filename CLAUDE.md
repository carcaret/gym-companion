# GymPRO — CLAUDE.md

## Descripción del proyecto

**GymPRO** es una PWA (Progressive Web App) en español para seguimiento personal de gimnasio. Permite registrar entrenamientos, métricas de rendimiento, visualizar progreso y sincronizar datos con GitHub. Sin frameworks — vanilla JS puro.

## Despliegue

- **Producción**: GitHub Pages (HTTPS) — rama `master`, raíz del repo
- **Local**: requiere servidor HTTP (VS Code Live Server, `npx serve`, `python -m http.server`). Abrir `index.html` directamente con `file://` no funciona — el Service Worker y `fetch('./db.json')` requieren HTTP/HTTPS.

## Arquitectura

```
index.html    → Estructura HTML: vistas (Hoy, Historial, Gráficas, Ajustes) + login
app.js        → Toda la lógica de la app (~1200 líneas)
index.css     → Dark theme con glassmorphism, variables CSS, mobile-first
db.json       → BD por defecto: ejercicios (~100), rutinas, credenciales; también archivo de sync con GitHub
manifest.json → Config PWA
sw.js         → Service Worker (cache network-first, omite GitHub API) — versión gympro-v3
```

## Stack técnico

- **Frontend**: Vanilla JS + CSS3 (sin frameworks)
- **Charts**: Chart.js v4.4.7 + date-fns adapter
- **Storage**: localStorage (primario) + GitHub REST API v3 (sync opcional)
- **Hashing**: Web Crypto API (SHA-256) con salt `GYMPRO_SALT_2024`
- **PWA**: Service Worker + Web Manifest

## Estructura de datos (db.json)

```javascript
{
  auth: { username, passwordHash },
  exercises: { [id]: { id, name } },          // ~100 ejercicios en español
  routines: { LUNES: [...ids], MIERCOLES: [...ids], VIERNES: [...ids] },
  history: [{ date, type, completed, logs: [{ exercise_id, name, series, reps, weight }] }]
}
```

## Funcionalidades clave

- **Autenticación**: SHA-256 + sal, sesión en localStorage, cambio de contraseña
- **Entrenamiento**: Rutinas Lun/Mié/Vie, registro por series (reps reales vs esperadas), detección de PRs
- **Métricas**: Volumen (peso × series × reps_avg), e1RM (peso × (1 + reps_avg/30))
- **Historial**: Filtro por tipo de rutina, detalle expandible
- **Gráficas**: Volumen, Peso, e1RM con Chart.js, selector de ejercicio y rango de fechas
- **Sync GitHub**: PUT API con token PAT cifrado (XOR + contraseña), auto-save con debounce 1200ms

## UX / Diseño

- Dark mode, acento púrpura `#6c5ce7`
- Mobile-first, safe area insets (notches)
- Bottom tab navigation, modales, toast notifications
- Animaciones: fade-up, bounce en badges de PR

## Convenciones de código

- Funciones en camelCase (`startWorkout`, `renderHistory`)
- IDs de ejercicios en snake_case (`curl_de_biceps_mancuerna`)
- Estado global en objeto `state` dentro de `app.js`
- Persistencia siempre vía `saveData()` → localStorage + GitHub sync
- `db` es la variable global con toda la BD en memoria

## Credenciales por defecto

- Usuario: `carlos`
- Password por defecto en db.json (hash SHA-256)

## Seguridad

- **NUNCA** commitear `.env` (contiene API keys)
- El PAT de GitHub se almacena cifrado con XOR en localStorage

## Commits automáticos

Al terminar cada sesión de modificación, se hace un commit automático con un resumen de los cambios realizados (hook configurado en `.claude/settings.json`).
