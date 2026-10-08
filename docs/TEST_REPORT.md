> Informe histórico de las diez funcionalidades avanzadas. La auditoría final del alcance exclusivamente local, incluida Radio de Sonaris, está en [LOCAL_FINAL_AUDIT.md](LOCAL_FINAL_AUDIT.md).

# Informe final de pruebas y auditoría avanzada

Fecha: 7 de octubre de 2026. Desarrollo sobre el proyecto existente en `/mnt/c/proyectos/sonaris`. Sin commits, despliegues ni subida de música. Las instrucciones de SONARIS.docx se adoptaron como requisitos de la ampliación solicitada, conservando las restricciones previas.

## Estado inicial

Ver docs/BASELINE_AUDIT.md: **51/51 pruebas**, TypeScript y build originales correctos. Los resultados de la primera entrega se conservan como documento histórico en AUDIT.md.

## Verificación final ejecutada

| Comprobación | Resultado real |
| --- | --- |
| Pruebas unitarias | **79/79 aprobadas**, 9 archivos, 95,66 s |
| Pruebas Chromium contra producción | **7/7 aprobadas**, 38,8 s |
| TypeScript estricto | Sin errores durante `npm run build` |
| Compilación Vite 7.3.7 | Exit 0; 32 módulos; 1,50 s |
| Artefactos PWA | Referencias de HTML y precache existentes; manifest e icono presentes; sin placeholders del worker |
| Revisión visual | Capturas de escritorio y móvil inspeccionadas; pestaña seleccionada visible y sin desbordamiento horizontal de la página |

Distribución de las pruebas unitarias: DoublyLinkedList 18, Patterns 14, Services 14, AppView 5, AdvancedStructures 13, AdvancedAudio 4, AdvancedPersistence 5, AdvancedInterface 4 y OfflineWorker 2. Incluyen operaciones repetidas con integridad de enlaces y pruebas de corrupción, cuotas, transacciones y caché.

Los siete escenarios de navegador cubren audio y funciones avanzadas, recarga offline y reproducción del archivo autorizado, paneles y teclado móvil, reproducción/listas/clones, fin de canción/repetición/eliminación, interfaz móvil original y errores de decodificación. Se ejecutaron sobre el build de producción con Chromium local. Las pruebas instrumentadas comprobaron un contexto y una fuente de audio, tres filtros y muestras reales no nulas. Esto no sustituye una evaluación auditiva humana.

Salida final: `dist/index.html` 0,63 kB; `dist/service-worker.js` 1,57 kB; CSS 22,54 kB (gzip 5,73 kB); JavaScript 74,07 kB (gzip 21,91 kB). Se incluyen `icon.svg` y `manifest.webmanifest`.

Comandos utilizados desde la raíz del proyecto, con Node local en PATH:

```bash
export PATH="$PWD/.tools/bin:$PATH"
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/browsers" LD_LIBRARY_PATH="$PWD/.tools/browser-libs/usr/lib/x86_64-linux-gnu" SONARIS_PRODUCTION_TEST=1 npm run test:e2e
```

Las capturas finales están en `test-results/advanced-desktop.png`, `test-results/advanced-mobile.png`, `test-results/desktop.png` y `test-results/mobile.png`. Son artefactos locales ignorados por Git.

No se contaron como éxitos las ejecuciones intermedias fallidas. Las pruebas unitarias no sustituyen la escucha humana; la lista pendiente está en docs/MANUAL_QA.md.

## Cobertura funcional

| Función | Evidencia |
| --- | --- |
| Visualizador real | Chromium leyó amplitudes no nulas del analizador del WAV; unit test verifica inicio/cancelación de rAF y Barras/Ondas |
| Reordenamiento | 500 movimientos deterministas con enlaces, identidad y tamaño comprobados; drag real durante reproducción y alternativas arriba/abajo |
| Nodos interactivos | Snapshots congelados, límites/vacío/único nodo; UI muestra vecinos y operaciones; inspección visual de capturas |
| Cola | Lista propia, prioridad sobre repetición, orden y purga; Chromium consume la entrada antes del avance normal |
| Ecualizador | Una cadena conectada, tres filtros; Chromium registra un solo contexto/fuente y tres BiquadFilterNodes tras cambios de canción/preset |
| Estadísticas | Umbral, sesiones, persistencia, ranking/días; buscar en el tiempo y eventos repetidos no inflan escucha; actividad real visible en Chromium |
| Temporizador | Un intervalo, reinicio, validación, atenuación/cancelación/restauración; Chromium verifica parada automática |
| Command | Agregar/eliminar/mover/renombrar/duplicar/borrar playlist, inversas, limpieza redo e integridad; drag con Undo/Redo en Chromium |
| Offline/PWA | Chromium en producción sin red: recarga, Blob autorizado recuperado, WAV reproducido, no autorizado omitido, borrado persistente y manifest |
| Atajos | Campos/controles/diálogos ignorados; seek/volumen/mute/edición; teclado de tabs móvil y ayuda en Chromium |

Las pruebas originales siguen cubriendo lista doble, Builder, Prototype, Factory Method, Abstract Factory, Adapter, Bridge, Decorator, importación, reproducción real, repetición, cambios de playlist, formatos inválidos y errores de decodificación.

## Problemas detectados y corregidos

1. Instalación de dependencias perdió .bin y el módulo nativo Linux de Rollup después de la auditoría inicial. Se reparó con npm install --offline, usando la caché y sin borrar código ni lockfile. No se agregaron dependencias de producción.
2. Primera prueba offline real: pantalla vacía al recuperar JS/CSS. Los recursos de preview usan Vary: Origin; las cabeceras de peticiones de módulos difieren de las de precarga. Se permite ignoreVary **solo para URLs estáticas propias incluidas en el precache**; se añadió prueba del worker. La repetición aislada aprobó, y después aprobó la suite completa.
3. Una prueba nueva del worker intentaba leer su archivo mediante URL transformada por Vite/jsdom. Se corrigió su lectura directa desde la raíz del proyecto; ambas pruebas del worker aprobaron.
4. Anterior al finalizar la última canción podía devolver la misma canción desde historial. Se omiten entradas iguales a la actual y se probó la regresión.
5. Se valida la estructura de estadísticas persistidas para no romper la interfaz ante datos corruptos ni mostrar fechas inválidas.
6. Preparación offline reutiliza una inscripción activa cuando no hay red; no informa como fallo un worker previamente preparado.
7. Al volver desde una edición reversible se recalculan las marcas de conservación para reflejar una eliminación explícita de archivos guardados.
8. Se ajustó el scroll horizontal de las pestañas móviles y la validación del mínimo del temporizador.

## Arquitectura y patrones

Se conservan modelos y servicios originales. Se añaden procesamiento AudioProcessingService, PlaybackQueue, PlaylistEditor/CommandHistory, StatisticsService, SleepTimerService, OfflineLibraryService/IndexedDbRepository, PwaService/worker, KeyboardShortcutService y AdvancedView/AudioVisualizer. Las playlists continúan siendo listas doblemente enlazadas; cola usa otra lista doble, edición usa dos pilas y reproducción usa historial acotado. Los arrays de almacenamiento/vistas son serialización temporal, no la playlist principal.

Ocho patrones usados: los siete originales más Command. Ubicaciones y flujos en PATTERNS.md; explicación de estructuras y ownership en docs/DATA_STRUCTURES.md.

## Inventario de cambios

### Archivos nuevos (27)

- `src/audio/AudioProcessingService.ts`
- `src/offline/PwaService.ts`
- `src/offline/worker.js`
- `src/patterns/command/CommandHistory.ts`
- `src/services/PlaybackQueue.ts`
- `src/services/PlaylistEditor.ts`
- `src/services/SleepTimerService.ts`
- `src/services/StatisticsService.ts`
- `src/services/OfflineLibraryService.ts`
- `src/services/KeyboardShortcutService.ts`
- `src/storage/IndexedDbRepository.ts`
- `src/ui/AdvancedView.ts`
- `src/ui/AudioVisualizer.ts`
- `src/ui/formatters.ts`
- `public/manifest.webmanifest`
- `public/icon.svg`
- `tests/AdvancedStructures.test.ts`
- `tests/AdvancedAudio.test.ts`
- `tests/AdvancedPersistence.test.ts`
- `tests/AdvancedInterface.test.ts`
- `tests/OfflineWorker.test.ts`
- `e2e/advanced.spec.ts`
- `docs/BASELINE_AUDIT.md`
- `docs/ADVANCED_FEATURES.md`
- `docs/DATA_STRUCTURES.md`
- `docs/TEST_REPORT.md`
- `docs/MANUAL_QA.md`

### Archivos modificados (18)

- `src/main.ts`
- `src/structures/DoublyLinkedList.ts`
- `src/models/Song.ts`
- `src/models/Playlist.ts`
- `src/patterns/builder/PlaylistBuilder.ts`
- `src/patterns/factory/SongImporter.ts`
- `src/patterns/bridge/AudioOutput.ts`
- `src/services/AudioPlayerService.ts`
- `src/ui/AppView.ts`
- `src/styles/main.css`
- `index.html`
- `vite.config.ts`
- `playwright.config.ts`
- `README.md`
- `PATTERNS.md`
- `AUDIT.md`
- `DEPLOYMENT.md`
- `package-lock.json`

Los demás archivos y pruebas originales se preservaron. node_modules, dist, .tools y test-results son recursos locales ignorados por Git. El lockfile se actualizó durante la reparación de la instalación; no se modificó configuración Git.

## Límites reales y revisión humana

No hay evaluación auditiva humana ni garantía de todos los códecs/dispositivos. IndexedDB y caché pertenecen al origen/navegador; solo archivos autorizados se recuperan, y el navegador puede eliminar datos. La denegación de persistencia o falta de espacio no bloquea el uso en memoria. El temporizador depende de que JavaScript vuelva a ejecutarse si el sistema suspende completamente la aplicación. Undo/Redo es acotado y no persiste; no revierte Play/Pause, estadísticas ni cola consumida. Crear playlist no forma parte del historial de edición.

La instalación PWA por el menú de cada sistema, lectores de pantalla, audición del EQ/fade, biblioteca personal y suspensión del equipo están pendientes de la revisión humana detallada en docs/MANUAL_QA.md. No se presentan como pruebas manuales ejecutadas.

## Ejecución y publicación

`bash tools/run-local.sh dev` usa Node local disponible; con Node propio: npm ci y npm run dev. Para comprobar offline: npm run build y npm run preview (localhost:4173), conservar canciones y preparar recursos desde el panel.

Publicar manualmente todo dist, incluidos service-worker.js, manifest.webmanifest e icon.svg. DEPLOYMENT.md describe las cuatro plataformas. No se ejecutó publicación ni se solicitaron credenciales. Los datos del equipo deben completarse en README.
