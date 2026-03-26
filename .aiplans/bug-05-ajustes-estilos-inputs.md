# Bug 5: Ajustes — inputs sin estilos del tema

## Síntomas reportados

Los inputs de la sección de Ajustes no tienen los estilos del tema oscuro (glassmorphism). Aparecen con el estilo por defecto del navegador (fondo blanco, borde gris).

## Causa raíz

En `index.css`, el selector que aplica estilos a los inputs dentro de `.input-group` es:

```css
.input-group input[type="text"],
.input-group input[type="password"],
.input-group input[type="date"],
.input-group input[type="number"],
.input-group input[type="file"],
.input-group select { ... }
```

En `AjustesView.tsx`, los inputs de texto no tienen atributo `type` explícito:

```tsx
<input id="set-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="usuario/repo" />
<input id="set-branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
<input id="set-path" value={path} onChange={(e) => setPath(e.target.value)} />
```

Aunque en HTML el tipo por defecto es `text`, el selector CSS `[type="text"]` **sólo coincide con atributos explícitamente presentes** en el DOM. Un `<input>` sin atributo `type` no coincide con `[type="text"]`, por lo que no recibe los estilos del tema.

Los inputs con `type="password"` y `type="file"` sí tienen el atributo y sí reciben estilos.

## Plan de corrección

### A. Añadir `type="text"` a todos los inputs de texto en AjustesView

En `AjustesView.tsx`, añadir `type="text"` explícito:

```tsx
<input id="set-repo" type="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="usuario/repo" />
<input id="set-branch" type="text" value={branch} onChange={(e) => setBranch(e.target.value)} />
<input id="set-path" type="text" value={path} onChange={(e) => setPath(e.target.value)} />
```

### B. (Alternativa CSS, más robusta) Simplificar selector en index.css

En lugar de listar tipos específicos, usar un selector que capture todos los inputs excepto los que tienen comportamiento especial (checkbox, radio, submit...):

```css
.input-group input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]),
.input-group select { ... }
```

O más simplemente, añadir también el caso sin tipo:

```css
.input-group input:not([type]),
.input-group input[type="text"],
...
```

**Preferir la opción A** (añadir `type="text"` explícito) por ser más explícita y no requerir cambios en CSS compartido.

## Archivos a modificar

- `src/presentation/features/settings/AjustesView.tsx`
  - Añadir `type="text"` a los 3 inputs sin tipo (set-repo, set-branch, set-path)

## Sin cambios en

- `index.css` (el selector es correcto, el bug está en los inputs)
- Lógica de la vista de Ajustes
- Otros inputs (password, file ya tienen tipo correcto)

## Verificar también en LoginView

Revisar si `LoginView.tsx` tiene inputs sin `type="text"` explícito. Si los tiene, aplicar el mismo fix.
