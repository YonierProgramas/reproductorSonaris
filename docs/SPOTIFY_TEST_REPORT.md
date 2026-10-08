# Auditoría de Sonaris con Spotify opcional

Fecha: 7 de octubre de 2026. Proyecto: `/mnt/c/proyectos/sonaris`. Alcance vigente: ampliación Spotify aprobada por el propietario a partir de SONARISsss.docx, conservando Mi música. **La implementación está preparada; no se declara integración real completa porque falta autorización y reproducción con la cuenta del propietario.** No hubo commits, despliegues ni cambios en otros proyectos.

## 1. Resumen de implementación

OAuth Authorization Code + PKCE S256, callback validado, refresh single-flight y rotación, cliente API con cancelación/timeout/límites/401/403/429, catálogo con búsqueda y navegación, Web Playback SDK diferido, controles según capacidades y coordinador exclusivo. Se conserva biblioteca local, radio por metadatos/semilla, listas dobles, ocho patrones y diez funciones avanzadas. Interfaz española, código inglés, colores claros.

## 2. Archivos creados y modificados

Creados:

- `src/music/MusicProvider.ts`, `LocalMusicProvider.ts`, `PlaybackCoordinator.ts`.
- `src/spotify/SpotifyAuthService.ts`, `SpotifyApiClient.ts`, `SpotifyCatalogAdapter.ts`, `SpotifyPlaybackAdapter.ts`, `SpotifyReferenceCollection.ts`, `SpotifySdk.ts`, `SpotifyError.ts`, `SpotifyIntegrationFactory.ts`.
- `src/ui/SpotifyView.ts`, `src/assets/spotify-logo.svg` (activo oficial sin modificación).
- `.env.local` (configuración pública local, ignorada) y `.env.example` (plantilla pública).
- `tests/SpotifyAuth.test.ts`, `SpotifyCatalog.test.ts`, `SpotifyPlayback.test.ts`, `e2e/spotify.spec.ts`.
- `docs/SPOTIFY_BASELINE.md`, `SPOTIFY_INTEGRATION.md`, `SPOTIFY_AUTHENTICATION.md`, `SPOTIFY_TEST_REPORT.md`, `SPOTIFY_MANUAL_QA.md`; capturas `docs/screenshots/spotify-optional.png` y `spotify-mocked-playback.png`.

Modificados: `src/main.ts` (composición/ciclo de vida), `src/ui/AppView.ts` (contenedor integrado), `src/services/AudioPlayerService.ts` (guardia antes de reproducir), `src/services/KeyboardShortcutService.ts` (habilitación por fuente), `src/styles/main.css`, `index.html` (no-referrer), `vite.config.ts` (puerto fijo), `.gitignore`, `README.md`, `PATTERNS.md`, `DEPLOYMENT.md`. No se sustituyeron las estructuras, modelos ni algoritmos locales.

Los archivos de módulos listados sin repetir carpeta pertenecen a la misma carpeta del primer archivo de cada viñeta. Logs locales en `.tools/validation/`, ignorados; dist también está ignorado. Los informes históricos locales se conservan y README identifica el informe vigente.

## 3. Arquitectura final

`MusicCatalogProvider` y `MusicPlaybackProvider` separan catálogo y reproducción. Las referencias remotas no contienen audio ni son Song. Los adaptadores envuelven APIs oficiales. `PlaybackCoordinator` pausa/cancela una fuente antes de iniciar la otra. Las playlists/radio/cola locales conservan nodos reales; `SpotifyReferenceCollection` tiene su propia lista doble, sin persistencia remota ni local. Los patrones académicos originales mantienen responsabilidades reales; la nueva factoría de composición no se contabiliza como patrón adicional artificial. [Diagrama y contratos](SPOTIFY_INTEGRATION.md).

## 4. Endpoints utilizados

Autorización `accounts.spotify.com/authorize`, token `accounts.spotify.com/api/token`; GET Web API `/me`, `/search`, `/artists/{id}/albums`, `/albums/{id}`, `/albums/{id}/tracks`; PUT `/me/player/play?device_id=…`; script oficial `sdk.scdn.co/spotify-player.js`. Pausa/reanudación/seek/volumen/estado mediante SDK. No recommendations, audio-analysis, descarga, previews, scraping ni endpoints masivos retirados. [Detalles](SPOTIFY_INTEGRATION.md).

## 5. Scopes solicitados

`streaming`, `user-read-email`, `user-read-private` (requisitos del SDK), `user-modify-playback-state` (iniciar URI en el dispositivo). No escritura de biblioteca/playlists ni historial de Spotify. [Justificación y consentimiento](SPOTIFY_AUTHENTICATION.md).

## 6. Funcionalidades verificadas

Las pruebas unitarias verifican enlaces head/tail/current/previous/next, operaciones y deduplicación, patrones, radio local, importación, persistencia, efectos/visualizador, cola, estadísticas, temporizador, edición y atajos. Chromium reproduce PCM local generado exclusivamente como fixture de prueba mediante HTMLAudioElement real; comprueba ended/repetición, errores de decodificación, playlists/copias/navegación, teclado, móvil, procesamiento Web Audio, reordenamiento, radio y PWA/IndexedDB.

Las pruebas nuevas verifican PKCE criptográfico, state/TTL/callback de un solo uso, supervivencia de la transacción al navegar, rechazo de sesión/permisos/tokens malformados, almacenamiento bloqueado, refresh/rotación/401, 403/429/cancelación/timeout/concurrencia, referencias normalizadas, paginación, URLs seguras, restricciones de reproducción, lista doble remota independiente, SDK preparado/sin Premium y exclusividad, incluidos inicio API y reanudación SDK pendientes.

OAuth/API/SDK en pruebas nuevas son **mocks explícitos**. Chromium comprueba navegación de autorización/retorno, búsqueda y controles reales de UI sobre esos mocks. No existe un modo de proveedor ficticio en producción. Abrir Sonaris y el panel sin conectar no provoca solicitudes Spotify.

## 7. Funcionalidades restringidas

La reproducción real necesita Premium, cuenta permitida, app/consentimiento válidos, red y DRM/navegador compatibles. Metadata y exploración pueden recibir 403 según permisos/restricciones. No se conoce la cuota real de esa app. Las funciones incompatibles permanecen locales: EQ/visualizador/fade/boost, estadísticas, temporizador, atajos, radio y offline. Referencias Spotify solo de sesión; no sincronizan playlists de la cuenta ni sustituyen las locales. Un API 204 nunca prueba audio. La sesión no persiste al recargar. Un archivo local no conservado tampoco sobrevive a la navegación OAuth.

## 8. Pruebas automatizadas y resultados

Entorno: Node 22.20.0 Linux, TypeScript 5.9, Vite 7.3.7, Vitest 3.2.7, Playwright 1.64 y Chromium Linux. Los binarios locales y librerías del navegador están en `.tools`; no son dependencias de producción.

| Validación | Resultado real |
| --- | --- |
| Baseline anterior a la ampliación | 98/98 unitarias; build exitoso |
| Suite completa tras corregir PKCE | 130/130, 13 archivos; 95,11 s |
| Suite final, incluida protección ante sessionStorage bloqueado | **131/131**, 13 archivos; **100,41 s**, código 0 |
| Chromium desarrollo, Spotify opcional/callback/mocks | 4/4; 43,5 s |
| Chromium build de producción, suite completa | **12 exitosos / 2 omitidos deliberadamente**, 45,7 s, código 0 |
| TypeScript estricto | Exitoso como paso obligatorio de build |
| Fixtures de Spotify dentro del JS de producción | Ninguna encontrada |
| `.env.local` ignorado / `.env.example` permitido | Reglas presentes y verificadas |
| Caché Service Worker | Solo recursos propios; GET del mismo origen |

Los dos recorridos OAuth completos con mocks usan el redirect de desarrollo 5173 y se omiten en la suite de producción 4173. Esa omisión es deliberada y no se cuenta como test exitoso. Producción sí comprueba panel opcional, rechazo de callback inválido y regresiones locales.

Comandos:

```bash
bash tools/run-local.sh test
bash tools/run-local.sh build
# Chromium instalado previamente en el entorno local:
export PATH="$PWD/.tools/bin:$PATH"
PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/browsers" \
LD_LIBRARY_PATH="$PWD/.tools/browser-libs/usr/lib/x86_64-linux-gnu" \
npm run test:e2e -- e2e/spotify.spec.ts
PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/browsers" \
LD_LIBRARY_PATH="$PWD/.tools/browser-libs/usr/lib/x86_64-linux-gnu" \
SONARIS_PRODUCTION_TEST=1 npm run test:e2e
```

Los logs locales finales son `spotify-final-unit.log`, `spotify-final-build.log`, `spotify-browser-development.log` y `spotify-browser-production.log` en `.tools/validation/`. En un equipo distinto instala dependencias con Node 22 y el navegador de Playwright; las rutas de librerías `.tools` solo corresponden a este entorno Linux. No hay auto retries ocultos.

## 9. Resultado del build

`npm run build` terminó con código 0: TypeScript estricto + Vite, 49 módulos, 1,49 s. Produjo `dist/index.html`, Service Worker, manifest/icono, logo oficial, CSS de 33,38 kB y JS de 138,26 kB (39,99 kB gzip). No incluye datos de prueba. No fue desplegado. El build permite Mi música sin autorización y configura el redirect de desarrollo 5173 para Spotify.

## 10. Pruebas manuales pendientes

Registrar/comprobar redirect y usuarios en el Dashboard, autorizar cuenta real, confirmar Premium y audio audible, comparar catálogo real, comprobar restricciones/cuotas del servicio y compatibilidad de DRM entre navegadores. Probar el callback HTTPS del hosting futuro. Completar datos académicos de README. [Checklist detallada](SPOTIFY_MANUAL_QA.md).

## 11. Problemas encontrados y solución

- Cinco errores de tipado en mocks: firmas corregidas; TypeScript estricto pasa.
- El primer escenario de importación E2E no activaba el selector y no establecía destino: la prueba ahora usa el flujo de importación real de UI.
- Fallo real al navegar hacia consentimiento: pagehide borraba la transacción PKCE. Disposal ahora borra tokens y cancela trabajo, conservando solo esa transacción de un uso con TTL; desconexión explícita la elimina. Prueba unitaria y navegación Chromium lo cubren.
- Riesgo de reproducción tardía al volver a local con inicio API o reanudación SDK pendientes: invalidación, abort y desconexión antes de permitir audio local; pruebas de ambas carreras pasan.
- Acceso inmediato a sessionStorage podía fallar al construir la integración opcional: acceso diferido y error controlado al conectar, con prueba específica.
- Reglas actuales de API/SDK: no usar `/me.product` como verificación Premium, no asumir recomendaciones disponibles y usar páginas de diez. Quedan documentadas restricciones y errores visibles.

No se afirma resolver fallos del Dashboard, plan Premium, cuota real, salida acústica o DRM sin una cuenta/navegador reales. Capturas de la interfaz autenticada muestran fixtures etiquetados de prueba, no una conexión real.

## 12. Ejecutar Sonaris

```bash
cd /mnt/c/proyectos/sonaris
bash tools/run-local.sh dev
```

Abrir `http://127.0.0.1:5173/`. Mi música funciona con archivos importados sin Spotify. [Activación paso a paso](SPOTIFY_AUTHENTICATION.md). Preview 4173 permite inspeccionar producción/local/PWA; no conecta Spotify con el redirect actual.

## 13. Despliegue posterior

Solo cuando el propietario lo decida: configurar Client ID público y redirect HTTPS definitivo, registrarlo exactamente en Dashboard, compilar de nuevo, subir `dist` a un hosting con fallback SPA para callback y comprobar flujo real/DRM/usuarios. Nunca publicar `.env.local`, node_modules, `.tools` ni tokens. GitHub Pages requiere resolver callback explícitamente porque no tiene rewrite SPA nativo. [Guía de despliegue](../DEPLOYMENT.md).
