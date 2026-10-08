> Documento histórico. El usuario canceló definitivamente las integraciones externas el 7 de octubre de 2026. Los cinco archivos parciales de `src/music/` se inspeccionaron y retiraron antes de completar una radio exclusivamente local. No se configuraron servicios ni credenciales. Consulta `LOCAL_FINAL_AUDIT.md` para el alcance vigente.

# Auditoría inicial de integración online

Proyecto inspeccionado: `/mnt/c/proyectos/sonaris`. La solicitud procede del documento «Actúa como arquitecto senior de software especializado en TypeScript.docx». Se conserva el proyecto, sin commits ni despliegues.

Antes de modificar código se inspeccionaron Song, SongNode, DoublyLinkedList, Playlist, PlaylistService, PlaylistEditor, AudioPlayerService, PlaybackQueue, AudioOutput, AudioProcessingService, OfflineLibraryService, IndexedDbRepository, las vistas, factories, Builder, configuraciones y pruebas. No se encontraron instrucciones AGENTS.md ni archivos de credenciales en el proyecto.

La biblioteca utiliza listas dobles reales con head/tail/current, integridad y snapshots. Cola propia; historial limitado; Command conserva retenciones de las fuentes y Undo/Redo. HTMLAudioElement y una cadena Web Audio única atienden archivos locales. IndexedDB guarda Blobs solo con autorización explícita; el service worker conserva únicamente el shell. Existen siete patrones originales y Command, TypeScript estricto y Vite; no hay backend ni catálogo externo.

Riesgos identificados: Song presupone File; las referencias online necesitan metadatos persistentes independientes de URLs temporales. AudioOutput presupone HTMLAudioElement, por lo que los SDK deben adaptar eventos y controles sin enviar DRM al grafo. La radio temporal no debe cambiar listas permanentes ni sus nodos. Las credenciales privadas requieren servidor, errores aislados y cancelación. Los resultados de API no pueden inventarse.

Los resultados iniciales se registraron antes de modificar código; Playwright regenera su carpeta de artefactos. Los logs de la validación final local se conservan en `.tools/validation/`. Resultado previo a los cambios: 79/79 pruebas aprobadas en 9 archivos (82,84 s); TypeScript sin errores y build exit 0, 32 módulos, 1,29 s. No se detectaron regresiones iniciales.
