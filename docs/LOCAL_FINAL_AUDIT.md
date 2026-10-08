# Auditoría final: Sonaris personal y local

Fecha de entrega: 7 de octubre de 2026. Workspace: `/mnt/c/proyectos/sonaris`. Se aplicó el cambio definitivo de alcance del usuario: archivos personales, radio local, diez funcionalidades avanzadas, TypeScript, interfaz española y colores claros. Sin commits ni despliegues.

## Resultado y arquitectura

Sonaris conserva el reproductor local, la importación múltiple, playlists, búsqueda, navegación, repetición, efectos, persistencia y ocho patrones justificados. Se integra Radio de Sonaris sin otro proyecto ni reproductor. Todas las playlists, incluso temporales y automáticas, conservan `DoublyLinkedList<Song>`; la cola también usa una lista doble real. Los arrays se limitan a buffers de ranking, páginas, historial de comandos/reproducción y serialización.

`LocalMetadataReader` enriquece archivos compatibles; `SongMetadata` sanea valores. `Song.libraryKey` conserva identidad de archivo entre clones y restauraciones. `LocalRecommendationEngine` genera orden reproducible ponderando metadatos, diversidad y azar. `LocalRadioService` compone Builder, Prototype, PlaylistService, PlaylistEditor y AudioPlayerService. `LocalRadioView` ofrece biblioteca global, búsqueda, paginación, configuración y acciones en español. El cierre de una sesión limpia solo comandos de su scope; el guardado permanente tiene su propio comando reversible.

La interfaz usa fondos claros con lila, rosa, melocotón y verde menta, conservando controles, foco y adaptación móvil. Se inspeccionaron capturas reales de escritorio/móvil; la prueba móvil verifica ausencia de desbordamiento horizontal.

## Funcionalidades verificadas

| Función | Estado y evidencia |
| --- | --- |
| Música personal | Importación y reproducción real WAV en Chromium; errores de decodificación visibles; otros códecs dependen del navegador |
| Playlists originales | Inserción inicial/final/posición, eliminación, renombrado, copia, navegación, modos y búsquedas preservados |
| Visualizador de audio | Datos reales no nulos; barras/ondas y cancelación de animación; grafo único comprobado |
| Reordenamiento | Drag real sin reiniciar reproducción; alternativas por menú; enlaces e identidad del nodo comprobados |
| Visualizador de nodos | Inicio/final/actual, vecinos y snapshots; radio guardada inspeccionada en Chromium |
| Cola inteligente | Lista doble propia; prioridad sobre avance/repetición; historial y purga preservados |
| Ecualizador | Tres filtros y presets; un contexto/fuente por elemento; controles probados |
| Estadísticas | Umbral de escucha, sesiones, fechas, persistencia; búsqueda temporal no infla el contador |
| Temporizador | Atenuación, reinicio/cancelación/parada y conservación del volumen base |
| Deshacer/Rehacer | Operaciones originales más guardar radio; cierre limpia únicamente la sesión temporal |
| Sin conexión | Consentimiento para Blobs, PWA/shell, recarga sin red y audio real; radio guardada y etiquetas restauradas |
| Atajos | Controles originales, ayuda, exclusión de campos y navegación de pestañas móvil |
| Radio local | Canción inicial primero, elección reproducible, metadatos reales o azar declarado, sin archivos duplicados dentro de la sesión |
| Radio automática y continua | Opcional desde biblioteca; lotes locales al quedar pocas canciones; agotamiento sin bucles ni resultados inventados |
| Biblioteca global | Búsqueda por datos locales, debounce y páginas de ocho archivos; copias de playlists agrupadas |
| Recursos | Retención/liberación y revocación final de Object URLs verificadas; copias y nodos independientes |

Los patrones existentes permanecen: Prototype, Builder, Factory Method, Abstract Factory, Adapter, Bridge, Decorator y Command. Su defensa se actualizó en `PATTERNS.md`.

## Inspección y retirada selectiva

Antes de trabajar se inspeccionó el estado interrumpido. La ampliación externa contenía cinco archivos nuevos sin uso en el reproductor; algunos referían propiedades todavía inexistentes en Song. Se retiraron únicamente:

- `src/music/ApiClient.ts`
- `src/music/types.ts`
- `src/music/TrackAdapter.ts`
- `src/music/providers/JamendoProvider.ts`
- `src/music/providers/LocalMusicProvider.ts`

Las carpetas vacías `src/music/` y `server/` se retiraron. No había backend implementado ni credenciales configuradas. No se revirtió código funcional. `ONLINE_INTEGRATION_BASELINE.md` se conserva como registro histórico, señalado como cancelado. La comprobación final no encontró adaptadores, SDK, URLs o variables de credenciales externas en src. El escenario Chromium de radio de escritorio registró cero solicitudes fuera de localhost/blob.

## Pruebas y build reales

BASELINE: antes de los cambios de integración se ejecutaron 79/79 pruebas unitarias, 9 archivos, 82,84 s; TypeScript y build exit 0 (32 módulos, 1,29 s). El cambio local conservó las 79 pruebas y añadió 19 unitarias y tres escenarios Chromium.

Unitarias: **98/98 aprobadas**, 10 archivos, **55,43 s**, exit 0. Distribución: DoublyLinkedList 18, Patterns 14, Services 14, AppView 5, AdvancedStructures 13, AdvancedAudio 4, AdvancedPersistence 5, AdvancedInterface 4, OfflineWorker 2 y LocalRadio 19. Las nuevas cubren aleatoriedad reproducible, puntuación y fallbacks, deduplicación, límites, integridad, continuidad, cola/repetición, clonación/guardado, limpieza de scopes, recursos, persistencia y parsing ID3/WAV/FLAC.

Chromium: **10/10 aprobadas**, 44,0 s, sobre producción, un worker. Incluye siete escenarios anteriores y tres nuevos: radio con nodos independientes y guardado reversible; generación automática, continuidad finita y móvil; radio guardada con metadatos recuperados y reproducción real sin red. No hubo excepciones de página en el escenario nuevo que recoge pageerror, ni solicitudes de servicios externos en su registro. Las fixtures WAV se generan en memoria exclusivamente dentro de las pruebas.

Build: **exit 0**, TypeScript estricto sin errores, Vite 7.3.7, **37 módulos**, **1,11 s**. `dist/index.html` 0,63 kB; `dist/service-worker.js` 1,57 kB; CSS 28,57 kB (gzip 7,04 kB); JavaScript 93,79 kB (gzip 27,93 kB). Icono y manifest incluidos. Las rutas de recursos del HTML compilado se comprobaron existentes. El build final produjo los mismos assets probados por Chromium.

Comandos desde la raíz, usando el Node local de esta sesión:

```bash
export PATH="$PWD/.tools/bin:$PATH"
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/browsers" LD_LIBRARY_PATH="$PWD/.tools/browser-libs/usr/lib/x86_64-linux-gnu" SONARIS_PRODUCTION_TEST=1 npm run test:e2e
```

Logs locales conservados en `.tools/validation/local-unit.log`, `local-browser.log` y `local-build.log`; capturas en `test-results/local-radio-desktop.png` y `local-radio-mobile.png`, además de las originales/avanzadas. Estos artefactos están ignorados por Git. Las pruebas unitarias usan salidas de audio y repositorios controlados; las de Chromium decodifican audio real y utilizan IndexedDB/service worker nativos. No equivalen a audición humana ni certificación de todos los dispositivos.

## Correcciones durante el trabajo

Se ajustaron dos pruebas nuevas: jsdom no aporta Object URLs nativas, por lo que la prueba de propiedad instala dobles explícitos; un tag truncado puede retornar metadatos vacíos normalizados, por lo que se verifica ausencia de información inventada. La ejecución inicial mostró 96/98 aprobadas; no se presenta esa ejecución como éxito final.

La revisión de integración corrigió el mensaje de agotamiento para notificarlo una vez, enriquecimiento asíncrono de copias del mismo archivo, exclusión de radios temporales de persistencia y consentimiento, conservación de una playlist permanente al borrar la original durante una sesión y descarte de comandos temporales sin perder el guardado permanente. La suite final verifica esos comportamientos.

## Inventario del cambio local

Archivos nuevos (9):

- `src/models/SongMetadata.ts`
- `src/services/LocalMetadataReader.ts`
- `src/radio/LocalRecommendationEngine.ts`
- `src/radio/LocalRadioService.ts`
- `src/ui/LocalRadioView.ts`
- `tests/LocalRadio.test.ts`
- `e2e/local-radio.spec.ts`
- `docs/SMART_RADIO.md`
- `docs/LOCAL_FINAL_AUDIT.md`

Archivos modificados respecto del estado inspeccionado (18):

- `src/models/Song.ts`
- `src/models/Playlist.ts`
- `src/patterns/factory/SongImporter.ts`
- `src/patterns/command/CommandHistory.ts`
- `src/services/PlaylistService.ts`
- `src/services/PlaylistEditor.ts`
- `src/services/OfflineLibraryService.ts`
- `src/ui/AppView.ts`
- `src/ui/AdvancedView.ts`
- `src/main.ts`
- `src/styles/main.css`
- `README.md`
- `PATTERNS.md`
- `DEPLOYMENT.md`
- `docs/MANUAL_QA.md`
- `docs/TEST_REPORT.md`
- `docs/DATA_STRUCTURES.md`
- `docs/ONLINE_INTEGRATION_BASELINE.md`

Además se regeneró dist. No se añadieron dependencias ni cambios a package.json/package-lock.json durante el cambio de alcance local.

## Límites y acciones manuales pendientes

No hay integraciones externas pendientes de activación ni credenciales que obtener. La radio solo puede elegir archivos existentes: una biblioteca vacía o pequeña produce pocas recomendaciones y un aviso real. La similitud es de metadatos, no acústica. La identidad por nombre/tamaño/fecha/MIME no sustituye un hash de contenido; sus límites y pesos están documentados en `SMART_RADIO.md`. El lector de etiquetas está acotado a formatos/banderas y 2 MiB; no extrae todos los tags ni portadas. La duración llega al cargar audio.

La sesión de radio es temporal. Para conservarla: Guardar como playlist y luego Conservar canciones de esta playlist. El navegador controla cuotas, retención, códecs, autoplay y suspensión. El historial reversible y la sesión temporal no sobreviven a una recarga.

El usuario debe completar `MANUAL_QA.md` con escucha propia, dispositivos, formatos, instalación PWA y lector de pantalla; completar autor/institución/docente del README si corresponde. Para ejecutar: `bash tools/run-local.sh dev`; para probar offline: `bash tools/run-local.sh preview` y abrir localhost:4173. Si más adelante decide publicar, seguir `DEPLOYMENT.md` y subir todo dist a un hosting estático HTTPS. No se ejecutó publicación ni commit.
