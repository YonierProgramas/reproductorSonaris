# Auditoría final de Sonaris

## Ampliación Shuffle local — 7 de octubre de 2026

Se incorporó **Modo → Aleatorio** usando `ShufflePlayback` sobre los nodos originales de la lista doble. Sin repeticiones automáticas en un ciclo; al agotarlo se pausa y muestra «Ciclo aleatorio terminado». Reproducir inicia explícitamente otro ciclo. Shuffle es una alternativa exclusiva a Normal, Repetir canción y Repetir playlist; cambiar de modo conserva la canción y su posición.

La cola manual tiene prioridad. Anterior recorre la escucha real y Siguiente recupera el recorrido adelantado mediante otra lista doble, manteniendo identificadores originales y propiedad de fuentes. El modo se conserva por playlist en localStorage e IndexedDB; el sorteo y el historial no persisten tras recargar. No se modificó la integración Spotify.

Validación final:

- **149/149 unitarias**, 14 archivos, 142,61 s; incluye **18 casos nuevos de Shuffle**.
- **TypeScript sin errores** (`npm run typecheck`, código 0).
- **Build exitoso**, 49 módulos, 3,00 s, código 0.
- **Chromium producción: 14 aprobadas, 2 omitidas deliberadamente**, 1,4 min; omisiones de OAuth por redirect de desarrollo.
- **Chromium desarrollo: 2/2 escenarios Shuffle aprobados**, 49,5 s, con audio WAV real generado para pruebas.

Se actualizaron README y PATTERNS, validadores de preferencias y la prueba de restauración offline. [Política, archivos y resultados completos](docs/SHUFFLE.md). Logs en `.tools/validation/shuffle-*`. Sin commits ni despliegues; los informes anteriores se conservan debajo como auditorías de sus entregas.

---

## Preparación para repositorio público de GitHub — 7 de octubre de 2026

**Resultado: preparado para publicar el código.** Esta comprobación no realiza publicación y no afirma reproducción real de Spotify. Se preservaron los archivos del proyecto; los cambios de esta preparación se limitan a `.gitignore` y esta entrada de auditoría.

- `.gitignore` excluye `node_modules/`, `dist/`, `.env`, `.env.local` y `.env.*`, conservando la excepción `.env.example`. También excluye recursos locales de herramientas, reportes generados, logs, audio privado en los formatos usados por Sonaris, carpetas privadas y exportaciones de tokens/credenciales/claves.
- Se verificaron **27 rutas de inclusión/exclusión con Git** mediante metadatos temporales aislados. `src/audio/`, `src/music/`, el resto del código, el lockfile y la plantilla pública siguen incluidos.
- Se revisaron **99 archivos elegibles**, incluidos código, pruebas, configuración y documentación. No se detectaron secretos reales. Los tokens de pruebas son fixtures ficticios; dos URL con usuario/contraseña de ejemplo se utilizan en pruebas negativas. Las capturas publicables muestran datos de prueba.
- El Client ID de Spotify es público; `.env.example` no contiene Client Secret ni tokens. `.npmrc` solo configura la caché local. `.env.local` queda excluido.
- `npm run build`: **exitoso**, TypeScript estricto y 49 módulos; Vite terminó en **2,92 s**.
- `npm test`: **131/131 pruebas**, 13 archivos, **235,11 s**, código 0.
- Chromium contra producción: **12 aprobadas y 2 omitidas deliberadamente**, código 0. Las dos omitidas requieren el callback de desarrollo 5173.
- Chromium desarrollo, `e2e/spotify.spec.ts`: **4/4 aprobadas**, **52,0 s**, código 0, con OAuth/API/SDK simulados únicamente en pruebas.
- La primera revisión automática de permisos para Chromium agotó su plazo; el reintento fue autorizado y las suites finalizaron correctamente.

Logs y detalle del escaneo en `.tools/validation/github-publication-*`, excluidos de Git. No se creó `.git` en Sonaris, ni se hizo staging, commit, push o despliegue. No existe historial del proyecto que auditar en este workspace: la revisión abarca los archivos actuales elegibles.

La autorización, configuración del Dashboard y reproducción audible real de Spotify siguen pendientes del propietario según [QA manual](docs/SPOTIFY_MANUAL_QA.md); esto no impide publicar el código. La integración y sus límites están documentados en [el informe vigente de Sonaris](docs/SPOTIFY_TEST_REPORT.md).

---

> Documento histórico de la primera entrega. Para la ampliación avanzada, consultar `docs/BASELINE_AUDIT.md` y `docs/TEST_REPORT.md`; este informe conserva los resultados originales.

Fecha: **7 de octubre de 2026** (America/Bogota). Proyecto desarrollado exclusivamente en `/mnt/c/proyectos/sonaris`. Se leyó íntegramente el documento Word de especificación; el nombre definitivo indicado en el chat prevaleció sobre el nombre sugerido del documento. No se hicieron commits, no se creó un repositorio y no se publicó en ninguna plataforma.

## 1. Archivos creados y modificados

La carpeta estaba vacía; todos los archivos siguientes son nuevos. Las revisiones durante el desarrollo modificaron estos mismos archivos.

- `.gitignore`
- `.npmrc`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `playwright.config.ts`
- `README.md`
- `PATTERNS.md`
- `DEPLOYMENT.md`
- `AUDIT.md`
- `src/main.ts`
- `src/models/Playlist.ts`
- `src/models/Song.ts`
- `src/patterns/adapter/AudioSource.ts`
- `src/patterns/adapter/LocalFileAudioAdapter.ts`
- `src/patterns/bridge/AudioOutput.ts`
- `src/patterns/bridge/PlaybackMode.ts`
- `src/patterns/builder/PlaylistBuilder.ts`
- `src/patterns/decorator/TrackPlayback.ts`
- `src/patterns/factory/PlayerEnvironmentFactory.ts`
- `src/patterns/factory/SongImporter.ts`
- `src/services/AudioPlayerService.ts`
- `src/services/PlaylistService.ts`
- `src/storage/StorageHandler.ts`
- `src/structures/DoublyLinkedList.ts`
- `src/structures/SongNode.ts`
- `src/styles/main.css`
- `src/ui/AppView.ts`
- `tests/AppView.test.ts`
- `tests/DoublyLinkedList.test.ts`
- `tests/Patterns.test.ts`
- `tests/Services.test.ts`
- `tests/helpers.ts`
- `e2e/sonaris.spec.ts`
- `tools/run-local.sh`

Artefactos locales: `node_modules/`, `dist/`, `.tools/`, `node-runtime.tar.xz` y `test-results/`. Se ignoran en Git. `.tools` contiene el runtime Node, caché npm, Chromium y bibliotecas extraídas localmente para las pruebas; no son dependencias distribuibles de la aplicación. Los archivos musicales de prueba se generan en memoria, no se incorporan al catálogo.

## 2. Arquitectura final

- **Composición:** main solicita fuentes, almacenamiento, salida y configuración mediante PlayerEnvironmentFactory.
- **Dominio:** Song conserva File, AudioSource, UUID y metadatos; Playlist tiene una lista doble propia y configuración.
- **Estructura:** SongNode y DoublyLinkedList almacenan canciones mediante enlaces reales. Map almacena las playlists; ningún array almacena el orden musical principal.
- **Aplicación:** PlaylistService gestiona altas, selección, cambio de nombre, duplicación y eliminación. AudioPlayerService centraliza el elemento audio, estados, progreso, errores, navegación, eventos ended y decoradores.
- **Infraestructura:** WebAudioOutput adapta la salida HTMLAudioElement; LocalFileAudioAdapter gestiona URLs de objeto; BrowserStorageHandler conserva solo configuración en localStorage.
- **Presentación:** AppView construye el DOM y enlaza controles; CSS organiza panel lateral y reproductor fijo con adaptación a móvil.

La selección reproducida se obtiene de `playlist.songs.current.song`. Anterior y siguiente cambian current mediante enlaces previous/next. La UI convierte listas temporalmente para ciertas vistas; las mutaciones y navegación permanecen en la estructura doble.

## 3. Patrones implementados

| Patrón | Ubicación y uso real |
| --- | --- |
| Factory Method | `src/patterns/factory/SongImporter.ts`: import usa createSong de la implementación local |
| Abstract Factory | `src/patterns/factory/PlayerEnvironmentFactory.ts`: composición de la familia web en main |
| Builder | `src/patterns/builder/PlaylistBuilder.ts`: creación y restauración en PlaylistService |
| Prototype | `src/models/Playlist.ts` y `src/models/Song.ts`: duplicación con nodos/UUID nuevos y fuentes retenidas |
| Adapter | `src/patterns/adapter/LocalFileAudioAdapter.ts`: File se convierte en AudioSource reproducible |
| Bridge | `src/patterns/bridge/PlaybackMode.ts` y `AudioOutput.ts`: modo de fin compuesto con salida |
| Decorator | `src/patterns/decorator/TrackPlayback.ts`: Basic, base delegadora, FadeIn y VolumeBoost combinables |

Participantes, problemas, flujos y demostraciones detallados en PATTERNS.md. No se omitió ninguno de los siete patrones. No se creó una plataforma desktop ni una API remota simulada.

## 4. Resultados reales de pruebas

### Vitest

Ejecución final de lógica: **51 aprobadas, 0 fallidas**, en 4 archivos. Duración reportada: **12,93 s**.

| Archivo | Pruebas aprobadas |
| --- | ---: |
| DoublyLinkedList.test.ts | 18 |
| Patterns.test.ts | 14 |
| Services.test.ts | 14 |
| AppView.test.ts | 5 |

Cobertura funcional: lista vacía, inserciones en extremos/medio, borrados en extremos/medio/único nodo, tamaño, recorridos bidireccionales, límites, selección actual, posiciones inválidas, limpieza y reutilización. Un caso realiza 500 operaciones mixtas deterministas contrastadas con una referencia y verifica enlaces después de cada operación.

También se probaron clones sin compartir nodos, retención/revocación de fuentes, importación válida/inválida, familia web, Builder, los tres modos, composición/cancelación de decoradores, rechazo de play, cambio de playlist, borrado de current, restauración de configuración, importación de lotes con rechazos, métodos estructurales llamados desde UI y escape de nombres de archivo contra inyección HTML.

Estas pruebas usan jsdom y FakeOutput: verifican lógica, no decodifican audio. El TypeScript de producción, pruebas unitarias, pruebas E2E y configuraciones se incluye en la comprobación estricta.

### Navegador real

Playwright con **Chromium real: 4 aprobadas, 0 fallidas**, duración total reportada **1,3 min**. Archivos WAV PCM generados por las pruebas se seleccionaron a través del input de archivos y fueron decodificados por HTMLAudioElement.

1. Importación al inicio/final/medio, orden y posición inválida; play/pausa, metadatos, progreso, seek, anterior/siguiente, efectos, nodos visibles, CRUD y clones; recarga conserva configuración y vacía audio.
2. Eventos ended reales: Normal termina, Repetir playlist vuelve al inicio y Repetir canción conserva la actual; borrar current detiene y selecciona vecino; borrar el último deshabilita controles.
3. Vista móvil **390×844**, sin desbordamiento horizontal; creación de playlist con teclado; controles visibles.
4. Archivo WAV corrupto produce error visible; una copia reproduce su audio después de eliminar la playlist original.

Las pruebas principal y de errores/recursos registraron **0 excepciones JavaScript de página**. El error de decodificación provocado fue gestionado por la aplicación, sin rechazo de promesa no controlado. Las advertencias NO_COLOR/FORCE_COLOR proceden del runner y no son errores de la aplicación.

Capturas generadas y revisadas: `test-results/desktop.png` y `test-results/mobile.png`. Chromium headless silencia la salida: estas comprobaciones verifican decodificación, progreso y comportamiento del elemento de audio, no una escucha humana.

### Incidencias resueltas

- Node no estaba disponible en Linux: se descargó Node 22.20.0 dentro del proyecto.
- El sandbox no permitía descargas ni servidor de navegador: se solicitaron las autorizaciones nativas correspondientes.
- Chromium carecía de libnspr4, libnss3 y libasound: se descargaron paquetes y se extrajeron en `.tools/browser-libs`, sin instalación global.
- Una prueba de UI detectó que agregar al final de una lista vacía usaba addFirst; se corrigió para llamar al método seleccionado.
- Se protegió el fade contra resolución/rechazo tardío tras una pausa y se evitó incrementar la posición de un lote cuando un archivo se rechaza.
- Se añadieron tipos de Node para comprobar también el TypeScript E2E.

## 5. Compilación final

`npm run build`: **exit code 0**. Ejecutó `tsc --noEmit` y Vite **7.3.7**. Transformó 19 módulos; compilación Vite en **1,29 s**.

```text
dist/index.html                 0.52 kB  (gzip 0.34 kB)
dist/assets/index-Drpct_fo.css  15.26 kB  (gzip 4.25 kB)
dist/assets/index-ChV5abGq.js   28.16 kB  (gzip 9.05 kB)
```

La base de recursos es relativa. Aplicación estática sin backend, credenciales ni variables de entorno.

## 6. Ejecución local

En este workspace WSL:

```bash
cd /mnt/c/proyectos/sonaris
bash tools/run-local.sh dev
```

Abre `http://localhost:5173` o el puerto alternativo que indique Vite. Con Node propio, basta `npm ci` seguido de `npm run dev`. Para servir dist, usa `npm run preview` (normalmente puerto 4173).

## 7. Acciones manuales del usuario

- Seleccionar tus archivos de audio desde el navegador. El agente no accedió a tu biblioteca privada.
- Completar integrantes, institución, docente y grupo en README.
- Escuchar con tus dispositivos y comprobar los formatos reales que usarás en la presentación; no se simula una auditoría acústica.
- Si decides publicar, acceder tú a tu cuenta y realizar los pasos de DEPLOYMENT.md.

## 8. Pendientes y límites

No quedan funcionalidades obligatorias de desarrollo pendientes. La persistencia conserva nombres, descripciones y modo de repetición; deliberadamente no conserva canciones, archivos ni URLs después de recargar. Debes seleccionar archivos otra vez.

La duración se obtiene al cargar la canción seleccionada. No se extraen etiquetas de artista: la UI indica Artista desconocido. El refuerzo multiplica el volumen con tope 1, no hace DSP. No se garantiza cada códec en todos los navegadores. Las pruebas de navegador son headless y no evalúan la percepción humana de sonido ni representan una certificación completa de accesibilidad.

## 9. Despliegue

Compilar con `npm run build` y publicar `dist`. DEPLOYMENT.md contiene pasos para Netlify manual, Vercel con Git, Cloudflare Pages directo y GitHub Pages con un flujo manual. No se ejecutó ningún despliegue ni se solicitaron credenciales.

## Matriz de especificaciones

| Secciones del documento | Estado y evidencia |
| --- | --- |
| 1. Proyecto/tecnología | Sonaris, TypeScript/HTML/CSS/Vite; sin React/Angular/Vue |
| 2–3. Taller/lista real | SongNode, head/tail/current/size; 12 operaciones públicas e iterador; pruebas de enlaces y operaciones desde UI |
| 4. Idioma | Identificadores y comentarios en inglés; HTML, controles, diálogos y mensajes en español |
| 5. Archivos reales | Selector múltiple, File, createObjectURL, HTMLAudioElement, liberación de URLs |
| 6. Varias playlists | Map de playlists; lista independiente por playlist; CRUD, selección y clonación |
| 7. Modelo Song | UUID, título, artista opcional, duración, archivo, MIME, URL y fuente |
| 8. Reproductor | Servicio central, estados, play/pause/stop, navegación, volumen, seek, metadata y ended |
| 9. Interfaz | Panel de playlists, portada, tabla, controles estructurales y reproductor inferior |
| 10–18. Patrones | Siete patrones reales; composición y defensa documentadas en PATTERNS.md |
| 19. Estructura | Capas y archivos solicitados; Prototype en el modelo donde se realiza la copia |
| 20. Persistencia | Solo configuración en localStorage; sin suponer permisos persistentes de archivos |
| 21. Validaciones | Nombres, vacío, límites, posiciones, formato, reproducción y borrado/cambio de lista |
| 22. Casos de lista | Todos los 16 casos exigidos, más pruebas mixtas y enlaces inversos |
| 23–25. Documentación | README/PATTERNS en español; comentarios técnicos en inglés |
| 26–27. Experiencia/responsive | Paleta clara, tarjetas, SVG, hover/disabled; escritorio y viewport 390×844 |
| 28. Accesibilidad | Labels, aria-label, idioma, dialog modal, foco, teclado, estados y contraste reforzado |
| 29. Despliegue | Build dist comprobado y procedimientos manuales; sin publicación |
| 30. Git | .gitignore correcto, sin commits y sin tocar configuración Git existente |
| 31–32. Calidad/fases | Estructuras → dominio → importación/audio → modos/efectos → UI → pruebas/documentación |
| 33. Resultado final | Funciones exigidas implementadas; límites reales declarados |
| 34. Informe final | Este archivo presenta inventario, arquitectura, patrones, pruebas, build, uso y publicación |
