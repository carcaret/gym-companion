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

## Despliegue

GitHub Pages — rama `master`, raíz del repositorio.
