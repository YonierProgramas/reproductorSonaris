# Estado inicial antes de Spotify

Fecha: 7 de octubre de 2026. Workspace inspeccionado: `/mnt/c/proyectos/sonaris`. El usuario confirmó sustituir el alcance local exclusivo por música local más Spotify opcional según SONARISsss.docx. No se implementarán Jamendo, Apple Music ni YouTube.

Se revisaron package.json, configuración Vite/TypeScript, composición main, Song y metadatos, Playlist/Builder/Prototype, SongNode/DoublyLinkedList, AudioPlayerService/AudioOutput/Bridge/Decorator, factories, PlaylistEditor/Command, cola, radio local, IndexedDB/offline/PWA, temporizador, teclado, vistas y pruebas. No se hallaron instrucciones AGENTS.md ni adaptadores Spotify existentes.

Estado: TypeScript/Vite sin framework UI ni backend; listas dobles reales para playlists y cola; ocho patrones; diez funciones avanzadas y radio local. Audio local exclusivamente por HTMLAudioElement/Object URLs y grafo Web Audio. Persistencia explícita de Blobs y metadatos; no guarda URLs ni sesión temporal de radio. No existen tokens ni secretos de Spotify.

Antes de modificar código: **98/98 pruebas unitarias**, 10 archivos, **57,37 s**. Build y TypeScript exit 0; **37 módulos, 1,29 s**. Logs conservados en `.tools/validation/spotify-baseline-unit.log` y `spotify-baseline-build.log`.

Riesgos a resolver: OAuth requiere navegar y regresar al mismo origen; archivos no conservados no sobreviven a esa navegación. /callback debe resolverse por el servidor estático. SDK EME depende del navegador/Premium y eventos reales. Dos reproductores requieren exclusión explícita, incluso durante solicitudes pendientes. Metadatos Spotify no deben mezclarse con Song/File, audio local, estadísticas, radio ni persistencia offline. Las pruebas simuladas no acreditan autorización ni reproducción real.
