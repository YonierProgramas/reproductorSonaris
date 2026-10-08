# Despliegue manual de Sonaris

No se publicó el proyecto ni se accedió a cuentas externas. Estas acciones las realiza el propietario cuando decida publicar.

## Preparación común

Desde la raíz del proyecto, con Node 22:

```bash
npm ci
npm test
npm run build
npm run preview
```

Comprueba la compilación en `http://localhost:4173` y detén la vista previa con Ctrl+C. Publica el contenido de `dist`, que incluye `index.html` y `assets`. `vite preview` es para comprobación local. [Guía oficial de Vite](https://vite.dev/guide/static-deploy.html).

## Netlify: carga manual sin repositorio

1. Inicia sesión en tu cuenta Netlify.
2. En la sección de proyectos, selecciona agregar un proyecto mediante despliegue manual, o abre Netlify Drop.
3. Arrastra la carpeta `dist` a la zona de carga.
4. Espera la publicación y abre la URL que muestra el panel.
5. Para una actualización, vuelve a compilar y carga el nuevo `dist` en los despliegues del mismo proyecto.

Si prefieres conectar Git, publica tú el repositorio y configura instalación `npm ci`, build `npm run build` y publicación `dist`. [Documentación oficial de Netlify](https://docs.netlify.com/deploy/create-deploys/).

## Vercel: importación desde Git

1. Crea y publica tú el repositorio con el código, el lockfile y `.gitignore`.
2. En tu cuenta Vercel selecciona agregar/importar proyecto y conecta ese repositorio.
3. Selecciona el preset Vite y raíz del proyecto donde está `package.json`.
4. Configura Node 22, instalación `npm ci`, build `npm run build` y directorio de salida `dist`.
5. Confirma Deploy y espera el enlace del proyecto.

Mi música no requiere variables de entorno. Para Spotify opcional consulta la configuración pública y el callback al final de este documento. [Guía oficial de Vite para Vercel](https://vite.dev/guide/static-deploy.html#vercel).

## Cloudflare Pages: carga directa

1. Inicia sesión en Cloudflare y abre Workers & Pages.
2. Crea una aplicación de Pages con carga de archivos/direct upload.
3. Indica un nombre de proyecto.
4. Carga la carpeta compilada `dist`, o un ZIP con `index.html` y `assets` en la raíz.
5. Confirma la publicación y abre el enlace `pages.dev` que se genere.

Para futuras actualizaciones, crea un nuevo despliegue en ese proyecto con la nueva compilación. [Documentación oficial de carga directa](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## GitHub Pages

1. Publica tú el repositorio en GitHub.
2. En Settings → Pages, selecciona GitHub Actions como origen.
3. Crea `.github/workflows/pages.yml` en tu repositorio con este contenido y publícalo. Es un flujo manual: solo se ejecuta cuando lo inicias desde Actions.

```yaml
name: Publish Sonaris
on:
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: sonaris-pages
  cancel-in-progress: false
jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.publish.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: publish
        uses: actions/deploy-pages@v5
```

4. En Actions, abre Publish Sonaris y pulsa Run workflow.
5. Espera a que termine y abre el enlace de Pages.

Sonaris usa URLs relativas (`base: './'`) y no tiene rutas de SPA, de modo que los recursos funcionan bajo la carpeta del repositorio. El ejemplo de Vite también permite fijar la base al nombre de tu repositorio si lo prefieres. [Guía oficial de Vite para Pages](https://vite.dev/guide/static-deploy.html#github-pages).

## Comprobación después de publicar

Abre la URL HTTPS, crea una playlist, importa un archivo local y comprueba play/pausa, anterior/siguiente, volumen y repetición. Los archivos no se suben al hosting; la configuración pertenece al localStorage de ese origen y no se transfiere desde localhost. Completa los datos del equipo en README antes de presentar el proyecto.


## Recursos de la ampliación offline

Publica **todo dist**, incluidos `service-worker.js`, `manifest.webmanifest`, `icon.svg`, `index.html` y `assets/`. La compilación genera automáticamente las rutas/versiones de caché; no copies únicamente el HTML. Tras publicar en HTTPS, abre la app, prepara modo sin conexión y conserva un audio de prueba desde el navegador. Recarga sin red para comprobar la instalación. No publiques archivos musicales ni `.tools`, `node_modules` o `test-results`. IndexedDB y estadísticas pertenecen al origen, por lo que no se transfieren desde localhost ni entre dominios.

## Alcance definitivo: reproductor personal

Sonaris no requiere servidor, APIs musicales, variables de entorno ni autenticación. No hay activación pendiente de proveedores. Publicar continúa siendo una acción manual del usuario; en esta entrega solo se genera dist. Usa todo dist y HTTPS si decides publicar. Los archivos personales no forman parte del build. Para guardar una radio, conviértela primero en playlist y autoriza sus archivos desde el panel Sin conexión del navegador donde se utilizará.

## Spotify opcional y callback en producción

### Vercel: reproductor-sonoris.vercel.app

El `vercel.json` de la raíz de Sonaris configura Vite, `npm run build`, salida `dist` y un rewrite interno de `/callback` a `/index.html`. Conserva la URL y sus parámetros `code` y `state` para que el cliente procese OAuth. Solo coincide con `/callback`: `/assets/*`, `/service-worker.js`, `/manifest.webmanifest` e `/icon.svg` conservan su resolución estática, incluidos los 404 de recursos inexistentes. No requiere cambiar `base: './'` de Vite.

En Vercel, la Root Directory debe ser la carpeta que contiene este `vercel.json` y `package.json` (`sonaris` si importas el directorio padre). En el entorno **Production**, configura `VITE_SPOTIFY_REDIRECT_URI=https://reproductor-sonoris.vercel.app/callback`. En Spotify Dashboard → Settings → Redirect URIs registra exactamente `https://reproductor-sonoris.vercel.app/callback`, sin barra final, query ni fragmento. Conserva el Client ID existente. Las variables VITE se incorporan al compilar: vuelve a desplegar después de modificar esta variable o incorporar el rewrite.

Tras desplegar, abre `/callback?code=invalid&state=invalid`: debe cargar Sonaris, limpiar la URL y rechazar la autorización, sin un 404 de Vercel. Después inicia una autorización desde la portada en la misma pestaña y verifica el retorno real. Comprueba que los recursos PWA mantienen su tipo de contenido y que Mi música reproduce un archivo local. Las pruebas con respuestas simuladas no verifican la URI guardada en el Dashboard ni la reproducción real de una cuenta Spotify.

[Documentación oficial de rewrites de Vercel](https://vercel.com/docs/routing/rewrites).

No se hizo ningún despliegue. Antes de publicar, configura `VITE_SPOTIFY_CLIENT_ID` con el identificador público de tu app y `VITE_SPOTIFY_REDIRECT_URI=https://tu-dominio/callback`; registra exactamente esa URL en el Dashboard y vuelve a compilar. No uses Client Secret ni tokens en variables VITE. El origen desde el que abres Sonaris debe coincidir con el origen del redirect.

El hosting debe servir la aplicación también al abrir `/callback` directamente. Vite dev/preview tiene fallback SPA; el hosting estático debe configurarlo. Para alojamiento en raíz, un archivo `_redirects` con `/callback /index.html 200` es una opción en plataformas que soportan esa sintaxis; en otras usa su regla equivalente de rewrite, no una redirección que pierda code/state. GitHub Pages no ofrece ese rewrite SPA de forma nativa: elige un hosting con fallback o prepara y comprueba una página callback real que cargue la misma app. No se declara ese flujo verificado en Pages.

Si alojas bajo una subruta, usa `https://tu-dominio/subruta/callback`, verifica que el hosting entrega la misma aplicación con los assets correctos y registra la URL exacta. La base relativa del build actual sirve un callback sin barra final en la misma carpeta; no registres callbacks con slash final. Comprueba también el alcance del Service Worker; solo almacena recursos propios, nunca respuestas/tokens/audio de Spotify.

La vista previa 4173 sirve para comprobar el build y Mi música; con el redirect preparado 5173 no autoriza Spotify. Para probar OAuth contra preview tendrías que registrar y compilar un redirect 4173 distinto; la guía habitual usa `bash tools/run-local.sh dev` y 127.0.0.1:5173. Consulta [autenticación](docs/SPOTIFY_AUTHENTICATION.md) y [QA manual](docs/SPOTIFY_MANUAL_QA.md).
