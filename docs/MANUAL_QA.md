# Comprobación manual para la entrega

Las pruebas automatizadas en Chromium decodifican archivos y comprueban la UI; **no son escucha humana** ni una certificación de accesibilidad. Esta lista está pendiente de realizar por el usuario con su música y dispositivos. No se marca como ejecutada por el agente.

1. Ejecutar npm run dev e importar MP3, WAV, OGG y M4A propios; escuchar, pausar, buscar, avanzar/retroceder, cambiar volumen y esperar el final en cada modo.
2. Durante una canción, arrastrar primer nodo al final y último al inicio; comprobar que no se reinicia el audio. Repetir con Mover arriba/abajo usando teclado.
3. Abrir Visualizador de lista doble. Inspeccionar inicio/final/actual y sus vecinos; insertar, borrar único nodo y deshacer; explicar cada enlace con el panel académico.
4. Agregar varias canciones a Cola, cambiar orden, quitar y vaciar. Probar prioridad sobre Repetir canción, Anterior y cambio de playlist. Borrar una canción encolada y comprobar purga.
5. Activar Barras/Ondas y comprobar respuesta al sonido. Pausar, ocultar panel/pestaña y reanudar. Escuchar Normal/Pop/Rock/Clásica y bandas personalizadas junto con fade/refuerzo; comprobar ausencia de distorsión audible con volumen razonable.
6. Escuchar más del umbral en Mis estadísticas; seleccionar sin reproducir y buscar en el tiempo no debe sumar. Cambiar el umbral, recargar y comprobar totales/ranking/fechas.
7. Probar temporizador personalizado breve y predefinidos; cambiar canción/volumen, cancelar, reiniciar. Confirmar atenuación y parada, y que el volumen base se conserva.
8. Agregar/eliminar/mover/renombrar/duplicar/eliminar playlist; deshacer/rehacer, crear una acción nueva tras deshacer y comprobar que Rehacer se limpia. Verificar la última playlist y los límites del historial.
9. Compilar y ejecutar npm run preview. Guardar solo un archivo, preparar recursos, desconectar red y recargar; solo ese archivo debe recuperarse y sonar. Eliminar archivo guardado, recargar y comprobar que desaparece. Denegar persistencia y mantener uso normal.
10. Instalar la PWA desde el navegador si está disponible; cerrarla y volver a abrir sin red. Repetir en el navegador/dispositivo que se usará para la presentación. Probar bajo la subruta real del hosting cuando se decida publicar.
11. Usar todos los atajos fuera de campos; escribir en búsqueda/nombres y manipular ranges/selecciones sin interferencias. Verificar Esc en diálogos, foco visible, lector de pantalla y navegación de pestañas con flechas/Home/End.
12. Revisar móvil en orientación vertical/horizontal, menús de filas, player inferior, cola larga y títulos extensos. Comprobar consola, almacenamiento bloqueado/modo privado y pérdida/limpieza de datos del navegador.

Registrar navegador, versión, dispositivo, formato y resultado. La audición, compatibilidad con todos los códecs, instalación PWA real en cada sistema, suspensión del equipo y lector de pantalla requieren esta revisión humana.

13. Con música propia, crear una radio, comparar una misma selección reproducible y otra diferente, probar etiquetas ID3/WAV/FLAC disponibles, revisar razones y diversidad. Sin etiquetas debe indicar selección aleatoria; no esperar que invente relaciones.
14. Escuchar hasta agotar la biblioteca con Reproducción continua; eliminar/reordenar recomendaciones y probar cola/repetición. Guardar como playlist, finalizar la radio y comprobar Deshacer/Rehacer del guardado sin alterar las originales.
15. Conservar los archivos de una radio guardada, recargar sin red y escucharla; comprobar que la radio temporal no reaparece. Verificar búsqueda global y paginación con una biblioteca grande.
