# Gym Companion

PWA para seguimiento personal de entrenos de gimnasio. Registra series, pesos y repeticiones, visualiza tu progreso con gráficas y sincroniza tus datos con GitHub.

## Desarrollo local

Desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador. Para parar el servidor, `Ctrl+C`.

Si quieres que abra el navegador automáticamente (Windows):

```bash
python -m http.server 8000 & start http://localhost:8000
```

> `file://` no funciona — el Service Worker y la carga de datos requieren HTTP.

## Tests

Tests E2E con [Playwright](https://playwright.dev/) (Chromium headless, viewport iPhone 14).

### Instalar dependencias (primera vez)

```bash
npm install
npx playwright install chromium
```

### Correr los tests

```bash
npm test                  # headless, salida en terminal
npm run test:headed       # abre ventana de navegador visible
npm run test:ui           # interfaz gráfica con replay paso a paso
```

Para correr solo un fichero:

```bash
npm test -- tests/hoy.spec.ts
```

### Estructura

```
tests/
  fixtures/
    testDb.json   # DB de test con usuario 'test' / contraseña 'test1234'
    seed.ts       # helpers para inyectar localStorage antes de cada test
  auth.spec.ts
  nav.spec.ts
  hoy.spec.ts
  historial.spec.ts
  graficas.spec.ts
  ajustes.spec.ts
```

El servidor se levanta automáticamente en `http://localhost:4321` al correr los tests.

## Despliegue

GitHub Pages — rama `master`, raíz del repositorio.
