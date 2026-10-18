# Bitácora de Hierro · Guía de publicación

- Repositorio: https://github.com/jfgitdc/bitacora-hierro
- Dirección de la app (cuando esté publicada): **https://jfgitdc.github.io/bitacora-hierro/**

## Archivos del proyecto

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño (colores, tipografía, tema claro/oscuro) |
| `app.js` | Lógica de la app: inicio de sesión, plantillas, sesiones, historial |
| `firebase-config.js` | Conexión con tu proyecto de Firebase y número de versión |
| `catalogo-ejercicios.json` | Catálogo de 144 ejercicios |
| `manifest.webmanifest` + `icons/` | Permite instalar la app en el celular |
| `sw.js` | Permite abrir la app sin conexión |
| `firestore.rules` | Reglas de seguridad de la base de datos (se pegan en Firebase, no hace falta subirlas a GitHub, pero no estorban) |

> **No subas `mis-datos-bitacora.json` a GitHub.** El repositorio es público y ese archivo tiene tus datos. Úsalo solo para importarlo desde la app.

---

## Paso 1 · Reglas de seguridad en Firebase

1. Entra a https://console.firebase.google.com → proyecto **bitacora-hierro**.
2. Menú **Firestore Database → Reglas**.
3. Borra lo que haya y pega el contenido completo de `firestore.rules`.
4. Toca **Publicar**.

Con esto, solo tu usuario puede leer y escribir tus datos.

## Paso 2 · Autorizar el dominio de la app

1. En Firebase: **Authentication → Configuración → Dominios autorizados**.
2. **Agregar dominio** → escribe `jfgitdc.github.io` → Agregar.

Sin este paso, el inicio de sesión falla al abrir la app desde GitHub Pages.

## Paso 3 · Subir los archivos a GitHub

1. Descomprime `bitacora-hierro-v1.1.zip` en tu computador.
2. Abre https://github.com/jfgitdc/bitacora-hierro.
3. Toca **Add file → Upload files** (si el repositorio está vacío, el enlace dice **uploading an existing file**).
4. Arrastra **todo el contenido** de la carpeta descomprimida, incluida la carpeta `icons`. Arrastra los archivos y la carpeta, no la carpeta `bitacora-hierro` entera, para que `index.html` quede en la raíz.
5. Abajo, en "Commit changes", escribe `Versión 1.1` y toca **Commit changes**.

Verifica que en la página del repositorio veas `index.html` directamente (no dentro de otra carpeta) y la carpeta `icons` con 4 imágenes.

## Paso 4 · Activar GitHub Pages

1. En el repositorio: **Settings → Pages**.
2. En **Build and deployment → Source** elige **Deploy from a branch**.
3. En **Branch** elige **main** y la carpeta **/ (root)** → **Save**.
4. Espera 1 o 2 minutos. Arriba aparecerá "Your site is live at https://jfgitdc.github.io/bitacora-hierro/".

## Paso 5 · Primer inicio de sesión e importación (mejor desde el computador)

1. Abre **https://jfgitdc.github.io/bitacora-hierro/** en el navegador del computador.
2. Entra con el correo y la contraseña del usuario que creaste en Firebase.
3. Toca **Importar mis datos (.json)** y elige `mis-datos-bitacora.json`.
4. Revisa la pestaña **Rutinas**: deben aparecer tus 4 plantillas y tu semana.

Los datos quedan en la nube, así que en el celular solo tendrás que iniciar sesión.

## Paso 6 · Instalar en el celular

- **Android (Chrome):** abre la dirección → menú **⋮** → **Instalar app** o **Agregar a la pantalla principal**.
- **iPhone (Safari):** abre la dirección → botón **Compartir** → **Agregar a inicio**.

Inicia sesión una vez con internet. Desde ahí la app abre y registra series aunque no tengas señal, y sincroniza sola cuando vuelve la conexión.

---

## Cómo se actualiza en el futuro

Cuando haya una versión nueva, te entregaré los archivos que cambiaron:

1. En GitHub: **Add file → Upload files**, arrastra los archivos nuevos (reemplazan a los anteriores) → **Commit changes**.
2. GitHub Pages publica en 1 o 2 minutos.
3. En el celular, abre la app con internet. Si no ves la versión nueva (abajo dice el número), ciérrala y ábrela otra vez.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| Error 404 al abrir la dirección | GitHub Pages no está activo o `index.html` quedó dentro de una subcarpeta |
| "El correo o la contraseña no coinciden" | Revisa el usuario en Firebase → Authentication → Usuarios, o usa "Olvidé mi contraseña" |
| El inicio de sesión no responde o da error de dominio | Falta el Paso 2 (dominio autorizado) |
| Entras pero no se guardan los datos | Falta el Paso 1 (reglas) o la base de datos Firestore no está creada |

---

## Flujo de cambios con *pull requests* (desde la v1.2)

1. Cada mejora se desarrolla en una **rama** aparte (por ejemplo `v2-progreso-ejercicios`), nunca directo en `main`.
2. Al terminar se abre un **pull request** (PR) hacia `main`. En la pestaña **Pull requests** del repositorio ves:
   - **Conversation**: qué cambia y por qué.
   - **Commits**: cada paso del trabajo.
   - **Files changed**: el detalle línea por línea (verde = agregado, rojo = quitado).
3. Si todo está bien, tocas **Merge pull request → Confirm merge**. GitHub Pages publica `main` en 1 o 2 minutos.
4. Después puedes borrar la rama con **Delete branch**.
5. En el celular, abre la app con internet; abajo verás el número de la versión nueva.

Las novedades de cada versión quedan en `CHANGELOG.md`.
