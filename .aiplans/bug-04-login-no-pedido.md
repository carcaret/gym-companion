# Bug 4: Login — no se muestra al entrar

## Síntomas reportados

Al cargar la app, no aparece la pantalla de login. La app entra directamente a la vista principal.

## Análisis

### Comportamiento observado (esperado por diseño)

En `App.tsx:31-43`, hay auto-login por sesión guardada en localStorage:

```typescript
useEffect(() => {
  const session = useCases.storage.getSession()
  const localDB = useCases.storage.load()
  if (session && localDB &&
      localDB.auth.username === session.user &&
      localDB.auth.passwordHash === session.hash) {
    setDB(localDB)
    setAuthenticated(true)
  }
}, [])
```

Si el usuario ya había iniciado sesión anteriormente (y no hizo logout), la sesión se guarda en `localStorage` con clave `gym_companion_session`. Al recargar la app, se valida automáticamente y se entra sin pedir credenciales. Este es el comportamiento intencionado (equivalente a "recordar sesión").

**Esto NO es un bug**, sino la funcionalidad de persistencia de sesión. El usuario no ve el login porque tiene una sesión activa de una visita anterior.

### Bug real detectado: nueva instalación sin datos

`LoginUseCase.execute()` carga la DB de localStorage (`gym_companion_db`). Si no hay datos guardados, devuelve `null` y lanza `AuthError('Credenciales incorrectas')`. Un usuario que nunca ha usado la app en este navegador **no puede iniciar sesión** porque no hay DB con la que comparar las credenciales.

El proyecto original vanilla JS cargaba `db.json` como datos por defecto si localStorage estaba vacío. El app React **no implementa esta inicialización**.

```typescript
// LocalStorageRepository.load():
load(): DB | null {
  const raw = localStorage.getItem('gym_companion_db')
  return raw ? JSON.parse(raw) : null  // ← null en primera visita → login falla siempre
}
```

## Plan de corrección

### A. Seeding de db.json en primera carga (bug real)

En `App.tsx`, en el mismo `useEffect` de inicialización, si `localDB` es `null`, hacer fetch de `./db.json` y guardar como DB inicial:

```typescript
useEffect(() => {
  async function init() {
    let localDB = useCases.storage.load()

    if (!localDB) {
      // Primera visita: cargar datos por defecto de db.json
      try {
        const res = await fetch('./db.json')
        if (res.ok) {
          const defaultDB = await res.json()
          useCases.storage.save(defaultDB)
          localDB = defaultDB
        }
      } catch {
        // sin db.json — dejar login en blanco
      }
    }

    const session = useCases.storage.getSession()
    if (session && localDB &&
        localDB.auth.username === session.user &&
        localDB.auth.passwordHash === session.hash) {
      setDB(localDB)
      setAuthenticated(true)
    }
  }
  init()
}, [])
```

### B. Auto-login: mantener comportamiento actual

La lógica de auto-login desde sesión es correcta y debe mantenerse. No hay cambios en ese flujo.

### C. Pantalla de carga mientras se verifica sesión

Actualmente, la app muestra login (pantalla vacía) durante el milisegundo que tarda en leer localStorage. Para evitar parpadeo, se puede añadir un tercer estado `initializing`:

```typescript
const [initializing, setInitializing] = useState(true)
// ...
// Al final del useEffect: setInitializing(false)
// En el render: if (initializing) return <div className="spinner" />
```

Esto es opcional — el parpadeo es imperceptible en la práctica.

## Archivos a modificar

- `src/App.tsx`
  - Convertir `useEffect` de init a función `async`
  - Añadir fetch de `./db.json` si localStorage está vacío
  - (Opcional) Estado `initializing` para evitar parpadeo

## Sin cambios en

- `LoginUseCase` (la lógica es correcta una vez que hay DB)
- `LocalStorageRepository` (correcto)
- La pantalla de login en sí
- `db.json` (ya existe con credenciales por defecto: `carlos`)
