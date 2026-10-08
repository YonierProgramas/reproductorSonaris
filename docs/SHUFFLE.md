# Reproducción aleatoria local

Selecciona **Modo → Aleatorio** en el reproductor local. El selector conserva Normal, Repetir canción y Repetir playlist. No se añade otro botón con un estado independiente: el selector es la única preferencia, evitando contradicciones entre Shuffle y repetición.

## Política de reproducción

- Aleatorio es un **modo exclusivo de ciclo único**, no una combinación con Repetir canción o Repetir playlist. La canción actual continúa sin recargar el audio ni cambiar su posición al activar/desactivar el modo.
- La canción seleccionada al activarlo es la primera del ciclo. Siguiente y el final natural de una canción eligen uniformemente entre los nodos no visitados. No hay repetición automática durante el ciclo.
- Al terminar, se pausa en la última canción y aparece **Ciclo aleatorio terminado**. No hay repetición automática de la playlist. Pulsar Reproducir inicia explícitamente otro ciclo desde la canción actual.
- Anterior recorre el historial real de escucha, no el vecino físico de la lista. Después de retroceder, Siguiente o el final de la canción recuperan primero el recorrido adelantado. Estas repeticiones solicitadas por navegación no son nuevas elecciones aleatorias.
- La cola manual tiene prioridad tanto con Siguiente como al terminar una canción. Puede repetir una canción intencionadamente; esa excepción pertenece a la cola, no al sorteo automático. Si la canción pertenece a la playlist activa, se marca visitada por su identificador original. Las canciones de otra playlist no consumen el ciclo activo.
- Una nueva entrada manual rompe el recorrido adelantado pendiente. Tras agotar la cola, se continúa con las canciones no visitadas de la playlist activa.
- Seleccionar explícitamente una canción o salir y volver a entrar en Aleatorio inicia un ciclo nuevo desde esa selección. Elegir Aleatorio cuando ya está activo no reinicia el ciclo. Cambiar a los otros modos restaura sus reglas existentes y descarta el recorrido adelantado de Shuffle.
- Las canciones añadidas son elegibles; las eliminadas no se sortean. Reordenar conserva los nodos y no reinicia el ciclo. Un archivo eliminado y restaurado con el mismo identificador conserva su condición de visitado hasta iniciar otro ciclo.
- Con una playlist vacía no hay reproducción ni navegación. Con una sola canción se reproduce una vez y se detiene. El historial del ciclo aleatorio no queda truncado por el límite normal de 50 entradas del reproductor.

## Arquitectura y persistencia

`ShufflePlayback` extiende `PlaybackMode` y utiliza la misma frontera Bridge con `AudioOutput`. Selecciona mediante reservoir sampling: una pasada O(n), memoria auxiliar constante para la elección y un Set de identificadores visitados O(n) para el ciclo. No crea un array de canciones, no mezcla ni sustituye los nodos, ni altera los enlaces de la playlist.

`AudioPlayerService` conserva el historial de reproducción existente y añade un recorrido adelantado mediante `PlaybackQueue`, otra lista doble real. Las referencias retienen/liberan la fuente de audio siguiendo las reglas existentes; conservan los identificadores originales incluso al reproducir clones de cola. El historial, el ciclo y las referencias adelantadas se limpian al cambiar de playlist o liberar el reproductor.

El valor `shuffle` se integra en `RepeatMode`, clonación, Builder, localStorage e instantáneas IndexedDB. Se restaura la preferencia de cada playlist y la selección de canciones conservadas. No se persisten el sorteo, el historial, la cola ni la posición de audio: después de recargar se inicia un ciclo nuevo sin autoplay. Los archivos requieren la autorización offline existente para sobrevivir a la recarga.

Spotify no se modifica. Shuffle solo afecta a AudioPlayerService local; los controles locales continúan deshabilitados cuando Spotify es la fuente activa. La radio y todas las demás capacidades existentes conservan sus reglas. Si la radio añade canciones durante una sesión, esos nuevos nodos son elegibles dentro del ciclo.

## Pruebas y resultados

Los casos de `tests/Shuffle.test.ts` cubren vacío, una canción, múltiples canciones, ausencia de duplicados, integridad de nodos, finalización/reinicio explícito, historial en reproducción y pausa, ciclos mayores de 50, cola local/externa, identificadores de clones, modificaciones de playlist, cambio de modo sin reinicio, preferencias y cambio de playlist. La prueba de persistencia offline también comprueba restauración de `shuffle`.

`e2e/shuffle.spec.ts` usa WAV generados como fixtures y audio real de Chromium: controles, historial, prioridad manual, cambios de modo sin reinicio, restauración tras recargar y finalización por eventos ended reales. La aleatoriedad se fija solamente en las pruebas para obtener resultados reproducibles.

Resultados verificados de esta ampliación:

| Comprobación | Resultado |
| --- | --- |
| Unitarias completas | **149/149**, 14 archivos, 142,61 s |
| Casos unitarios nuevos de Shuffle | **18/18** |
| `npm run typecheck` | **Código 0**, sin errores |
| Chromium desarrollo, Shuffle con audio real | **2/2**, 49,5 s |
| Build final | **Código 0**, 49 módulos, 3,00 s; JS 140,86 kB (40,64 kB gzip) |
| Chromium producción, regresiones completas | **14 aprobadas / 2 omitidas deliberadamente**, 1,4 min, código 0 |

Los logs locales están en `.tools/validation/shuffle-final-unit.log`, `shuffle-final-typecheck.log`, `shuffle-final-build.log`, `shuffle-browser-development.log` y `shuffle-browser-production.log`. Las omisiones de OAuth en producción se identifican explícitamente y no cuentan como pruebas exitosas.

Archivos modificados: `PlaybackMode.ts`, `AudioPlayerService.ts`, `Playlist.ts`, `StorageHandler.ts`, `OfflineLibraryService.ts`, `AppView.ts`, `AdvancedPersistence.test.ts`, README, PATTERNS y AUDIT. Archivos nuevos: `tests/Shuffle.test.ts`, `e2e/shuffle.spec.ts` y este documento. No se modificaron módulos, SDK ni adaptadores Spotify.

No se realizaron commits ni despliegues.
