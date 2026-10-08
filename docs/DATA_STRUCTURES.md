# Estructuras de datos

## Playlist: lista doble real

DoublyLinkedList conserva head, tail, current y tamaño; SongNode posee song, previous y next. `moveNode(fromIndex,toIndex)` interpreta toIndex como la posición final, desconecta y reinserta **el mismo nodo**, sin cambiar current ni tamaño. No reconstruye la lista con arrays. Vacío requiere índices inválidos; una lista de un nodo admite movimiento 0→0 sin cambios.

`assertIntegrity()` detecta ciclos, cuenta nodos, comprueba enlaces recíprocos, límites y pertenencia de current. `readSnapshot()` devuelve colección y registros congelados de IDs, vecinos y marcas de inicio/final/actual. No entrega nodos ni permite modificar sus enlaces. El visualizador obtiene estos datos reales, y busca los títulos por ID.

Arrastrar una fila sobre otra usa la posición real de destino, incluso si hay búsqueda activa. El menú de cada canción ofrece Mover arriba/abajo como alternativa con teclado. La visualización distingue listas vacías y único nodo, inspección de vecinos y explicación de operaciones.

## Cola enlazada

PlaybackQueue usa otra DoublyLinkedList de PlaybackEntry; los nodos nunca pertenecen a la playlist musical. Cada entrada conserva una copia de Song y retiene la fuente compartida. Reproducir a continuación inserta al inicio; Agregar a la cola inserta al final. Mover arriba/abajo llama moveNode. Quitar, vaciar o purgar por eliminación libera sus fuentes.

La cola tiene prioridad tanto en Siguiente como al terminar un archivo. El nodo actual de la playlist es el **ancla**, y no cambia al consumir cola. Al vaciarse, el avance vuelve desde ese ancla: siguiente por enlace en Normal, misma canción en Repetir canción y vuelta al inicio al final en Repetir playlist. Anterior usa el historial escuchado si está disponible; de otro modo recorre previous. Cambiar de playlist reinicia el historial y establece otra ancla, pero conserva la cola independiente.

El historial de reproducción es una pila acotada de 50 entradas retenidas, separada de la edición. Solo guarda canciones cuyo play realmente inició. No vuelve a insertar entradas consumidas en la cola. Eliminar una canción/playlist purga entradas y detiene la actual si procede. Deshacer una eliminación restaura la estructura, pero no restaura estados de reproducción ni colas ya consumidas.

## Command y dos pilas

CommandHistory posee undoStack y redoStack (arrays usados como **pilas de comandos**, nunca como playlist). EditCommand encapsula ejecutar, deshacer y liberar; PlaylistEditor actúa como receptor/coordinador. Cada edición nueva limpia redo; el historial está acotado a 100 operaciones. Insertar/eliminar conserva referencias de audio para permitir reversión; descartarlas libera su propietario de historial. Duplicar/eliminar playlist conserva sus nodos mientras la operación sea reversible, y los libera si se descarta estando fuera de la biblioteca.

Son reversibles: agregar, eliminar y mover canción, renombrar, duplicar y eliminar playlist. Crear playlist no entra en este historial. Play, pausa, cola, presets, estadísticas y temporizador no son ediciones reversibles. El historial no persiste tras recargar. La selección anterior se recupera al deshacer un borrado cuando todavía existe.

## Serialización

Los arrays de registros persistidos son un formato de serialización. La recuperación usa Builder, Factory Method y addLast para construir nodos nuevos uno por uno; nunca reemplaza la estructura interna con un array. Los UUID se conservan al restaurar archivos; Prototype genera UUID nuevos al duplicar. Las URLs de objeto se reconstruyen desde blobs y no se guardan como URLs persistentes.

## Radio local y listas automáticas

LocalRadioService crea una Playlist temporal con DoublyLinkedList<Song>, canción inicial en head y recomendaciones enlazadas al final. Guardar usa Prototype y crea identificadores/nodos independientes. libraryKey conserva identidad de archivo entre clones, sin persistir URLs. Un Set de exclusión evita volver a generar archivos incluidos o retirados durante la misma sesión. Buffers de scoring y paginación no reemplazan la lista.

Las listas temporales se excluyen de ambos almacenamientos. El historial Command añade scope y descarte selectivo al finalizar: no elimina operaciones permanentes. Cola y reproducción conservan sus estructuras y límites anteriores. La copia guardada admite Undo/Redo después de cerrar la radio. Consulte SMART_RADIO.md y LOCAL_FINAL_AUDIT.md para algoritmo y verificación.
