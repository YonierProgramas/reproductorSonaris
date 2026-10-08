# Auditoría inicial de la ampliación

7 de octubre de 2026. Se inspeccionaron modelos, estructuras, servicios, composición, adaptadores, factorías, Builder, Bridge, Decorator, almacenamiento, AppView y pruebas existentes antes de modificar código.

- Sonaris 1.0: TypeScript 5.9, Vite 7.3.7, Vitest 3.2.7, Playwright 1.64, jsdom. Sin framework UI ni backend.
- Cada Playlist posee DoublyLinkedList<Song>; SongNode contiene previous/next. current pertenece a la lista y los botones recorren enlaces.
- Importación File → SongImporter → LocalFileAudioAdapter → Object URL → WebAudioOutput/HTMLAudioElement. Fuentes con retención para copias y liberación al eliminar.
- Siete patrones existentes: Factory Method y Abstract Factory (factorías), Builder (PlaylistBuilder), Prototype (modelos), Adapter (fuentes), Bridge (modos/salida), Decorator (fade/refuerzo).
- LocalStorage guarda únicamente configuración; no hay IndexedDB, cola, Command, filtros, AudioContext ni PWA.
- UI en español con paleta clara; estructura de nodos estática, playlists y reproducción completas.
- Pruebas iniciales ejecutadas: **51/51 aprobadas**, 4 archivos, 27,66 s.
- Build inicial ejecutado separadamente con PATH de Node Linux: **exit 0**, TypeScript correcto, 19 módulos, 1,45 s de Vite. dist generado.
- El primer comando encadenado buscó npm de Windows en su segunda instrucción y falló por PATH; la compilación Linux posterior aprobó. Es un problema del entorno, no de Sonaris.
- Audio real ya dispone de suite Chromium; se conservará y ampliará. Las pruebas unitarias utilizan FakeOutput.

Se extenderán los mismos modelos y servicios. No se reemplazará la estructura musical con arrays. Se añadirán servicios de cola, edición, procesamiento Web Audio, temporizador, estadísticas y persistencia, más paneles independientes. Riesgos a verificar: ownership de recursos durante Undo/Redo y cola, una única ruta Web Audio, consentimiento para archivos persistidos, conservación de selección durante movimientos y restauración desde blobs.
