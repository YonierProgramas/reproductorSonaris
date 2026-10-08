# Patrones de diseño de Sonaris

Los siete patrones originales y Command se utilizan en el flujo real. La integración opcional de Spotify usa servicios oficiales; su validación con cuenta real permanece pendiente. No hay implementaciones desktop ficticias. Las pruebas automatizadas de `tests/Patterns.test.ts` y `tests/Services.test.ts` permiten revisar sus contratos, además de las demostraciones en la interfaz.

## Factory Method

**Problema:** la interfaz y el reproductor no deben saber cómo validar un archivo ni construir una canción a partir de una fuente.

**Solución y participantes:** `SongImporter` es el creador abstracto. Su operación pública `import()` ejecuta validación y delega al método factoría protegido `createSong()`. `LocalFileSongImporter` es el creador concreto; `Song` es el producto. El flujo de UI usa el tipo abstracto `SongImporter`, no depende de una construcción directa de Song.

**Archivos:** `src/patterns/factory/SongImporter.ts`, `src/models/Song.ts`, `src/main.ts`, `src/ui/AppView.ts`.

**Flujo:** selector de archivos → `SongImporter.import(file)` → validación → `LocalFileSongImporter.createSong(file)` → obtención de fuente por el handler → Song → nodo de la lista.

**Demostración:** importar un archivo real y observar título derivado del nombre. Un archivo vacío o sin tipo/extensión admitida se rechaza. Spotify utiliza referencias y un adaptador separado: no importa audio remoto ni construye Song a partir de URLs protegidas.

## Abstract Factory

**Problema:** la composición necesita una familia compatible de fuentes, almacenamiento, salida de audio y configuración del navegador; crear esos elementos directamente en distintos componentes mezcla dependencias del entorno.

**Solución y participantes:** `PlayerEnvironmentFactory` declara `createSources`, `createStorage`, `createOutput` y `createConfiguration`. `WebPlayerFactory` entrega `LocalAudioSourceHandler`, `BrowserStorageHandler`, `WebAudioOutput` y configuración web. Los clientes son el punto de composición, el importador y los servicios. Los productos se consumen por sus interfaces.

**Archivos:** `src/patterns/factory/PlayerEnvironmentFactory.ts`, `src/patterns/adapter/AudioSource.ts`, `src/storage/StorageHandler.ts`, `src/patterns/bridge/AudioOutput.ts`, `src/main.ts`.

**Flujo:** main solicita la familia → construye servicios e importador con productos compatibles → construye la vista. La configuración define volumen inicial, duración del fade y factor del refuerzo.

**Demostración:** abrir Sonaris e importar/reproducir; inspeccionar `main.ts` y la prueba de familia web. No es un selector cosmético de entornos en la UI. Se mantiene una sola implementación web real. La frontera facilita pruebas con otras salidas y almacenamiento; no se creó DesktopPlayerFactory.

## Builder

**Problema:** una playlist combina nombre obligatorio, descripción y modo de repetición; no debe quedar parcialmente configurada ni con un nombre vacío.

**Solución y participantes:** `PlaylistBuilder` acumula configuración mediante `withName`, `withDescription` y `withRepeatMode`; `build()` entrega `Playlist` validada. `PlaylistService` es el cliente y usa el Builder para creación y restauración.

**Archivos:** `src/patterns/builder/PlaylistBuilder.ts`, `src/models/Playlist.ts`, `src/services/PlaylistService.ts`.

**Flujo:** formulario o registro persistido → setters fluidos → build → validación del modelo → playlist vacía válida → colección de playlists.

**Demostración:** crear con nombre y descripción, intentar nombre formado solo por espacios y modificar repetición después. La construcción de copias usa el método Prototype del modelo, no exige volver a rellenar un formulario.

## Prototype

**Problema:** duplicar una colección configurada y ordenada sin compartir enlaces mutables ni romper el audio de una copia cuando se elimina la otra.

**Solución y participantes:** `Playlist` es el prototipo concreto y declara `clone()`. La copia recibe nuevo UUID, configuración y lista propia. `Song.clone()` crea otra canción con nuevo UUID, retiene la fuente compartida y conserva duración. Cada `addLast` construye un nodo nuevo. Se conserva la selección equivalente del original.

**Archivos:** `src/models/Playlist.ts`, `src/models/Song.ts`, `src/structures/DoublyLinkedList.ts`, `src/services/PlaylistService.ts`.

**Flujo:** Duplicar playlist → `PlaylistService.duplicate()` → `Playlist.clone()` → nuevas canciones y nodos → nueva lista seleccionable. El título visible agrega «(copia)».

**Demostración:** importar tres canciones, seleccionar la segunda, duplicar, eliminar la primera de la copia y volver al original. Orden, tamaño y selección del original permanecen intactos. Eliminar una playlist completa no invalida las URLs de la otra.

## Adapter

**Problema:** File no es una URL reproducible y su ciclo de vida difiere del contrato del reproductor. El servicio no debe manejar detalles de `URL.createObjectURL`.

**Solución y participantes:** Target: `AudioSource` (`url`, `retain`, `release`). Adapter: `LocalFileAudioAdapter`. Adaptee: `File` y la File/Object URL API del navegador. Client: `AudioPlayerService` a través de `AudioOutput`, además del importador y modelo para el ciclo de vida.

**Archivos:** `src/patterns/adapter/AudioSource.ts`, `src/patterns/adapter/LocalFileAudioAdapter.ts`, `src/models/Song.ts`, `src/patterns/bridge/AudioOutput.ts`, `src/services/AudioPlayerService.ts`.

**Flujo:** handler crea adapter desde File → adapter genera URL → Song conserva fuente → salida web carga `source.url` → reproducción. Una clonación retiene; cada eliminación libera; la última liberación revoca exactamente una vez. El reproductor desconecta la fuente antes de liberar el archivo actual.

**Demostración:** importar y reproducir un archivo local. Duplicar playlist, eliminar original y comprobar que la copia aún reproduce. La prueba automatizada espía createObjectURL/revokeObjectURL para verificar el ciclo de vida; no se modifica un objeto nativo para fingir el patrón.

## Bridge

**Problema:** el comportamiento al terminar una canción y la tecnología de salida pueden variar independientemente. Evitar clases por cada combinación de modo y salida.

**Solución y participantes:** Abstraction: `PlaybackMode`, que mantiene por composición una referencia a `AudioOutput`. Refined abstractions: `NormalPlayback`, `RepeatOnePlayback` y `RepeatAllPlayback`. Implementor: `AudioOutput`. Concrete implementor: `WebAudioOutput`. La abstracción decide el destino; la implementación carga la fuente o pausa la salida.

**Archivos:** `src/patterns/bridge/PlaybackMode.ts`, `src/patterns/bridge/AudioOutput.ts`, `src/services/AudioPlayerService.ts`.

**Flujo:** evento ended → servicio delega a `mode.onEnded(playlist)` → abstracción obtiene siguiente/current/head → salida carga fuente o pausa → servicio inicia reproducción decorada si hay destino. Normal conserva el último nodo y termina; repetir canción recarga current; repetir playlist vuelve a head al llegar a tail.

**Demostración:** seleccionar cada modo y esperar al final. La navegación manual siempre recorre los enlaces y no aplica wrap ni repetición automática. Las pruebas usan `FakeOutput` para comprobar que la misma abstracción admite otra implementación sin clases combinadas.

## Decorator

**Problema:** permitir efectos combinables sin agregar condiciones de volumen y temporizadores a toda la lógica del reproductor ni multiplicar subclases para cada combinación.

**Solución y participantes:** Component: `TrackPlayback` (`play`, `pause`, `setVolume`, `dispose`). ConcreteComponent: `BasicTrackPlayback`, que delega a AudioOutput. BaseDecorator: `TrackPlaybackDecorator`, que conserva y delega a un componente de la misma interfaz. ConcreteDecorators: `VolumeBoostDecorator` y `FadeInDecorator`.

**Archivos:** `src/patterns/decorator/TrackPlayback.ts`, `src/services/AudioPlayerService.ts`, `src/ui/AppView.ts`.

**Flujo:** controles de efectos → servicio reconstruye composición → Basic se envuelve opcionalmente en VolumeBoost y luego en FadeIn → todo se consume como TrackPlayback. La composición de ambos equivale a:

```typescript
new FadeInDecorator(
  new VolumeBoostDecorator(
    new BasicTrackPlayback(output),
    configuration.boostFactor
  ),
  configuration.fadeDuration
)
```

**Demostración:** usar un volumen de 40 %, activar refuerzo y comparar la salida (54 % efectivo); activar entrada gradual y escuchar el aumento progresivo, luego activar ambos. El valor del slider representa el volumen base. A volúmenes altos el refuerzo se satura en 100 %; no es amplificación DSP. Pausar, cambiar de canción o desactivar efectos cancela temporizadores. Las pruebas verifican la combinación, límites, errores de play y cancelación de una entrada gradual pendiente.

## Decisiones transversales

- La lista doble es la fuente de verdad de orden y selección; no se sustituye por arrays.
- AudioPlayerService centraliza audio, eventos, errores y modos; AppView gestiona DOM y acciones.
- Las playlists mantienen selecciones independientes. Un cambio detiene y desconecta la reproducción anterior.
- LocalStorage guarda configuración, nunca URLs temporales ni supuestos permisos para recuperar archivos.
- La implementación incluye exactamente dos decoradores útiles. No se agregó logging sin una necesidad funcional ni una integración remota/desktop de muestra.


## Command: edición reversible

**Problema:** revertir cambios estructurales sin reconstruir una playlist desde arrays, sin liberar prematuramente archivos que pueden restaurarse y sin mezclar reproducción con edición.

**Participantes:** Command declara execute/undo/dispose. EditCommand es el comando concreto que compone acciones inversas y liberación de recursos. CommandHistory es el invocador y mantiene undoStack/redoStack, acotadas a 100 operaciones. PlaylistEditor coordina los receptores Playlist, DoublyLinkedList y PlaylistService, y sincroniza AudioPlayerService después de cada edición. AppView y KeyboardShortcutService son clientes.

**Archivos:** `src/patterns/command/CommandHistory.ts`, `src/services/PlaylistEditor.ts`, `src/ui/AppView.ts`, `src/services/KeyboardShortcutService.ts`.

**Flujo:** acción de interfaz → editor crea comando con su inversa → invocador ejecuta y agrega a undo → usuario deshace → comando pasa a redo → usuario rehace → vuelve a undo. Una edición nueva descarta redo y libera sus recursos. Insertar/eliminar retiene una fuente para mantener el audio disponible al revertir. Mover aplica moveNode inverso sobre el mismo nodo. Eliminar una playlist conserva sus nodos mientras exista su comando; descartar la eliminación aplicada los libera.

**Demostración:** agregar tres archivos, mover el primero al final, eliminar una canción, pulsar Deshacer dos veces y Rehacer. Renombrar o duplicar también es reversible. Eliminar la última playlist crea una vacía; Deshacer restaura la anterior. Play/Pause, temporizador, cola y estadísticas no entran en el historial. No se persiste el historial después de recargar.

## Integración avanzada de los patrones originales

- **Prototype:** copias conservan nodos y UUID nuevos. Cola e historial de reproducción retienen fuentes mediante Song.clone; nunca usan nodos de una playlist como nodos de cola.
- **Builder:** restauración de configuraciones y playlists guardadas utiliza Builder, ahora con withId para recuperar identidad autorizada.
- **Factory Method:** SongImporter acepta un ID opcional para recuperación desde Blob/File; conserva validación y creación delegada.
- **Abstract Factory:** WebPlayerFactory sigue componiendo la familia web. No se creó otra factoría artificial para cada función.
- **Adapter:** URLs nuevas desde archivos recuperados; los registros IndexedDB contienen blobs, no URLs efímeras.
- **Bridge:** Normal/RepeatOne/RepeatAll siguen gobernando el destino de la playlist después de atender la cola.
- **Decorator:** fade y refuerzo siguen envolviendo BasicTrackPlayback; su salida pasa por la única cadena Web Audio. El temporizador usa atenuación temporal separada del volumen base. El ecualizador real usa BiquadFilterNodes, no decoradores ficticios.

Consultar docs/DATA_STRUCTURES.md para las invariantes y propiedad de recursos durante cola, deshacer y persistencia.

## Radio exclusivamente local

La radio amplía receptores existentes sin crear reproductores o proveedores ficticios. **Builder** crea la sesión Playlist temporal, cuyo orden y selección pertenecen a DoublyLinkedList. **Prototype** conserva los archivos mediante retención, con nuevos UUID y nodos para la sesión y para Guardar como playlist. **Factory Method** mantiene importación y restauración, ahora aceptando metadatos locales saneados. **Adapter** sigue generando Object URLs desde archivos; no existe adaptador remoto. **Bridge**, **Decorator** y **Abstract Factory** permanecen en la reproducción original.

**Command** incorpora scope de playlist y discardScope. Finalizar/regenerar una radio descarta solo comandos de esa sesión y libera sus retenciones; conserva ediciones de playlists permanentes. saveSnapshot registra una copia permanente reversible, cuyo scope propio sobrevive al cierre de la radio. No se persisten comandos ni listas temporales. Las pruebas verifican liberación final de URLs, Undo/Redo tras cerrar la sesión e independencia de nodos.

LocalRecommendationEngine es un servicio de dominio con pesos configurables y generador inyectado; no se presenta artificialmente como un noveno patrón. Los buffers de puntuación son transitorios, mientras todas las playlists y la cola conservan listas dobles reales.

## Ampliación Spotify: fronteras de los patrones

Los ocho patrones anteriores se conservan en el flujo local. `LocalMusicProvider` y `SpotifyCatalogAdapter` adaptan contratos de catálogo sin equiparar File y referencia remota. `SpotifyPlaybackAdapter` adapta el SDK al contrato pequeño `MusicPlaybackProvider`; mantiene capacidades de Spotify fuera de interfaces locales para respetar segregación. `PlaybackCoordinator` recibe esas dependencias y arbitra una sola fuente activa. `SpotifyIntegrationFactory` es una factoría de composición compatible; no se cuenta como un noveno patrón ni se confunde con el Factory Method del importador.

Bridge y Decorator siguen en la reproducción local; no se aplica boost, fade ni EQ al SDK. Strategy sigue resolviendo repetición/radio locales; no usa recomendaciones externas. Command conserva edición/reordenamiento/deshacer de las listas locales; la colección de referencias de sesión tiene nodos propios y no modifica esas playlists. Los eventos de autenticación/SDK actualizan la UI sin crear estadísticas de escucha Spotify. Consulta [arquitectura](docs/SPOTIFY_INTEGRATION.md) y [pruebas](docs/SPOTIFY_TEST_REPORT.md).

## Modo Aleatorio local

`ShufflePlayback` amplía la jerarquía `PlaybackMode` del Bridge usando la misma salida de audio. La elección aleatoria recorre los nodos reales con reservoir sampling y un Set de identificadores visitados; no reordena ni reemplaza la lista. AudioPlayerService coordina la cola prioritaria y el historial, manteniendo las responsabilidades de salida, selección y organización separadas. Builder, Prototype y almacenamiento conservan la nueva preferencia por playlist. Spotify mantiene sus adaptadores y controles autorizados sin modificaciones. [Política y verificación](docs/SHUFFLE.md).
