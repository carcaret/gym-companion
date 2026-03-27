# Gym Companion

PWA para seguimiento personal de entrenos de gimnasio. Registra series, pesos y repeticiones, visualiza tu progreso con gráficas y sincroniza tus datos con GitHub.

## Desarrollo local

Desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador. Para parar el servidor, `Ctrl+C`.

### Devcontainer (Codespaces / VS Code Remote)

```bash
npx serve -l 8000
```

El devcontainer redirige automáticamente el puerto. Abre la URL que aparece en la pestaña **Ports** de VS Code o navega a `http://localhost:8000` en Chrome.

> `file://` no funciona — el Service Worker y la carga de datos requieren HTTP.

## Despliegue

GitHub Pages — rama `master`, raíz del repositorio.
