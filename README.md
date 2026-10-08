# Sonaris

Reproductor web académico de música local con Spotify opcional para **Estructuras de Datos / Patrones de Software**. Desarrollado con TypeScript orientado a objetos, HTML5, CSS y Vite, sin frameworks de interfaz ni backend. Código e identificadores en inglés; interfaz y documentación en español.

El objetivo es demostrar una lista doblemente enlazada real y patrones que resuelven problemas concretos de importación, organización y reproducción. No contiene canciones ficticias: debes seleccionar archivos de audio de tu equipo. La ampliación avanzada conserva la arquitectura e incorpora diez funciones reales; consulta [docs/ADVANCED_FEATURES.md](docs/ADVANCED_FEATURES.md). La Radio de Sonaris crea selecciones automáticas exclusivamente con archivos importados; no necesita APIs, cuentas ni credenciales. El informe local anterior se conserva en [docs/LOCAL_FINAL_AUDIT.md](docs/LOCAL_FINAL_AUDIT.md); el informe vigente de esta ampliación está en [docs/SPOTIFY_TEST_REPORT.md](docs/SPOTIFY_TEST_REPORT.md).

**Validación vigente tras Shuffle:** 149 pruebas unitarias pasan; Chromium: 14 escenarios de producción pasan (2 OAuth de desarrollo omitidos) y los 2 escenarios nuevos de Shuffle pasan también en desarrollo. TypeScript y build de producción exitosos. [Resultados y política de Aleatorio](docs/SHUFFLE.md). La autorización y reproducción Spotify reales siguen requiriendo QA del propietario.

## Reproducción aleatoria

El selector **Modo → Aleatorio** recorre la playlist local sin repeticiones automáticas y se detiene al completar un ciclo. Mantiene la canción actual al cambiar de modo, respeta el historial anterior/siguiente y da prioridad a la cola manual. La preferencia se conserva por playlist; los ciclos se reinician al recargar. [Política, arquitectura y pruebas](docs/SHUFFLE.md).

## Spotify opcional

La última ampliación aprobada añade un espacio de búsqueda de canciones, artistas y álbumes, una colección de referencias de sesión en lista doble y reproducción mediante **Web Playback SDK oficial**. **Mi música** conserva radio local, playlists automáticas, efectos, cola, estadísticas y archivos offline. El coordinador permite una sola fuente activa y mantiene separados los archivos locales y el audio protegido.

La configuración pública está preparada en `.env.local` y documentada en `.env.example`. No hay Client Secret ni backend; los tokens solo viven en memoria. Para activar la cuenta debes registrar el redirect exacto, verificar los usuarios permitidos del Dashboard y autorizar el consentimiento. La reproducción exige Premium y un navegador compatible. No se ha comprobado reproducción real con tu cuenta.

- [Arquitectura, endpoints y límites](docs/SPOTIFY_INTEGRATION.md).
- [Configuración y autenticación paso a paso](docs/SPOTIFY_AUTHENTICATION.md).
- [Resultados reales de pruebas y build](docs/SPOTIFY_TEST_REPORT.md).
- [Lista de comprobación manual con cuenta real](docs/SPOTIFY_MANUAL_QA.md).

## Requisitos e instalación

Node.js 22.12 o superior (también Vite admite Node 20.19+), npm y un navegador moderno con HTMLAudioElement, File API, Object URLs, Web Crypto y elementos dialog. Para Spotify abre 127.0.0.1:5173 o el origen HTTPS configurado.

```bash
cd /mnt/c/proyectos/sonaris
npm ci
npm run dev
```

Abre **http://127.0.0.1:5173/**; el redirect de Spotify preparado usa este origen y el puerto fijo 5173. En Windows puedes abrir la carpeta `C:\proyectos\sonaris` y ejecutar los mismos comandos desde una terminal con Node instalado.

Para esta sesión de desarrollo se descargó Node dentro de `.tools/`, porque Linux no lo tenía en PATH. Es un recurso local ignorado por Git. Si deseas usarlo desde WSL:

```bash
export PATH="$PWD/.tools/bin:$PATH"
npm run dev
```

También puedes ejecutar `bash tools/run-local.sh dev`, que detecta el runtime local de esta sesión.

No es necesario conservar ese recurso cuando dispongas de tu instalación habitual de Node.

## Uso

1. Pulsa **Nueva playlist**, escribe un nombre y una descripción opcional. Nombres repetidos están permitidos porque las listas se identifican por UUID; nombres vacíos no están permitidos.
2. En **Agregar canciones** elige **Al inicio**, **Al final** o **En una posición**. Las posiciones visibles comienzan en **1**; puedes insertar desde 1 hasta el tamaño de la lista más 1. Selecciona uno o varios archivos. Se conserva el orden que entrega el selector del navegador.
3. Pulsa el título de una canción para seleccionarla y reproducirla. También puedes usar el botón central del reproductor, anterior y siguiente. Estos últimos están deshabilitados en los límites de la lista.
4. Arrastra el progreso para cambiar el tiempo y el volumen para ajustar la salida. La duración aparece después de cargar los metadatos de esa canción.
5. Elige **Normal**, **Repetir canción** o **Repetir playlist**. La repetición se aplica al terminar una canción; la navegación manual respeta los límites.
6. Activa **Entrada gradual** y **Refuerzo de volumen** por separado o juntos. La entrada gradual dura 1,6 segundos al iniciar o reanudar; el refuerzo multiplica el volumen por 1,35 y lo limita al máximo del navegador.
7. Usa **Duplicar playlist**, **Renombrar** o **Eliminar playlist**. La eliminación de una playlist requiere confirmación en un diálogo. Si eliminas la última, se crea una nueva lista vacía llamada Favoritas.
8. El icono de papelera de cada fila elimina esa canción. Si era la actual, se detiene el audio y se selecciona su siguiente, su anterior o ninguna, en ese orden. Cambiar de playlist detiene el audio y conserva la selección propia de cada lista.
9. La búsqueda filtra la vista de la playlist activa sin alterar la estructura ni el orden. **Ver cómo funciona**, en el panel lateral de escritorio, muestra los nodos conectados y destaca el actual.

MP3, WAV, M4A, OGG, AAC, FLAC, Opus y WebM dependen de los códecs de cada navegador. El selector/validador admite archivos de audio, pero la decodificación efectiva la decide HTMLAudioElement. Un archivo corrupto o un formato no reproducible genera un mensaje visible. No se leen carpetas sin tu intervención.

## Radio de Sonaris: solo tu música

En **Tu biblioteca, nuevos caminos** puedes buscar canciones en todas tus playlists por título, artista, álbum o género. La vista agrupa copias del mismo archivo y ofrece paginación; no modifica las listas originales.

- **Crear radio:** selecciona una canción inicial, una selección reproducible (entero de 0 a 4294967295) y entre 1 y 50 canciones por lote. La radio comienza con esa canción y añade archivos disponibles sin duplicados.
- **Crear radio al escuchar desde la biblioteca:** activa la generación automática al pulsar Escuchar en una tarjeta de biblioteca. Si está desactivada, esa acción abre una escucha temporal de una sola canción. Reproducir desde una playlist permanente conserva su funcionamiento habitual.
- **Reproducción continua:** al quedar menos de tres canciones posteriores, añade otro lote local. Cuando la biblioteca se agota, lo informa y deja de añadir. Los modos de repetición siguen siendo explícitos; repetir una canción no crea otro nodo.
- **Generar nueva selección:** reinicia la radio conservando la canción inicial. Con el mismo número, metadatos y biblioteca, reproduce el mismo orden; cambia el número para variar la mezcla.
- **Agregar a la radio:** añade manualmente un archivo de la biblioteca que no se haya incluido. Desde Mis playlists puedes mover, eliminar recomendaciones, recorrer nodos y deshacer/rehacer.
- **Guardar como playlist:** genera un UUID y nodos propios conservando orden y archivos; el guardado admite Deshacer/Rehacer. **Finalizar radio** elimina únicamente la sesión temporal y sus comandos.

La radio temporal no se restaura tras recargar. Para conservarla, guárdala como playlist y después pulsa **Conservar canciones de esta playlist** en Sin conexión. El guardado de la playlist no implica guardar automáticamente sus archivos.

El algoritmo pondera coincidencias reales de artista, álbum, género, etiquetas y palabras del título; aplica diversidad de artistas y un generador seudoaleatorio con semilla. Sin metadatos utiliza selección aleatoria, indicada explícitamente. Consulta [docs/SMART_RADIO.md](docs/SMART_RADIO.md) para pesos, deduplicación y límites.

## Estructura

```text
src/
  main.ts                         Composición del entorno y liberación de recursos
  models/                         Song, Playlist y modo de repetición
  structures/                     SongNode y DoublyLinkedList
  audio/                          Cadena única de procesamiento Web Audio
  radio/                          Radio local y selección ponderada reproducible
  offline/                        Registro PWA y plantilla del Service Worker
  patterns/
    builder/                      PlaylistBuilder
    factory/                      SongImporter y PlayerEnvironmentFactory
    adapter/                      AudioSource y LocalFileAudioAdapter
    bridge/                       AudioOutput y PlaybackMode
    decorator/                    TrackPlayback y decoradores
    command/                      CommandHistory y comandos de edición
  services/                       Audio, playlists, edición, cola, estadísticas, temporizador y offline
  storage/                        Configuración e IndexedDbRepository
  ui/                             AppView, AdvancedView, AudioVisualizer y renderizado
  styles/                         Interfaz clara y responsive
public/                           Manifest y SVG de instalación
docs/                             Auditorías, ampliación, estructuras, pruebas y QA manual
tests/                            Pruebas de estructura, patrones y servicios
index.html                        Entrada HTML en español
vite.config.ts                    Base relativa y configuración Vitest
tsconfig.json                     TypeScript estricto
PATTERNS.md                       Defensa académica de ocho patrones
AUDIT.md                          Resultados y límites reales de verificación
```

## Lista doblemente enlazada

Cada `Playlist` posee una `DoublyLinkedList<Song>`. Cada `SongNode` tiene `song`, `previous` y `next`. La lista conserva `head`, `tail`, `current` y `size`. Se implementan `addFirst`, `addLast`, `insertAt`, `removeAt`, `removeById`, `getAt`, `moveNext`, `movePrevious`, `setCurrent`, `clear`, `isEmpty` y `getSize`.

Los índices internos empiezan en 0. `head.previous` y `tail.next` siempre son nulos; los enlaces intermedios son recíprocos. Insertar enlaza el nodo nuevo con ambos vecinos; eliminar reconecta a sus vecinos y desvincula el nodo retirado. `getAt` recorre desde el extremo más cercano. `moveNext` y `movePrevious` acceden directamente a `current.next` y `current.previous`, sin índices de arrays. Una operación de navegación en un límite devuelve null y conserva el nodo actual.

Se usan arrays temporales para renderizar playlists, guardar configuración y pruebas de referencia; el contenido musical de cada playlist se almacena exclusivamente en nodos. Una copia posee nuevos nodos y nuevos objetos Song. `moveNode` recoloca el mismo nodo, sin cambiar su identidad, tamaño o selección; `readSnapshot` presenta datos congelados de enlaces y `assertIntegrity` comprueba las invariantes. Comparte únicamente el recurso de archivo/URL mediante retención y liberación contada.

## Funciones avanzadas

- **Visualizador:** pestaña Audio, activar/desactivar y alternar Barras/Ondas; usa frecuencia/forma de onda real de AnalyserNode.
- **Reordenar:** arrastra una fila sobre otra, o usa Mover arriba/abajo en el menú ⋯. El nodo actual sigue reproduciéndose.
- **Nodos interactivos:** Visualizador de lista doble, con inicio/final/actual, selección de un nodo, vecinos y explicación académica.
- **Cola:** menú ⋯ → Reproducir a continuación o Agregar a la cola; pestaña Cola para mover, quitar o vaciar.
- **Ecualizador:** Audio → graves, medios y agudos, presets Normal/Pop/Rock/Clásica/Personalizado y Restablecer.
- **Estadísticas:** tiempos reales, reproducciones tras cinco segundos de escucha (umbral configurable), ranking, recientes y actividad semanal.
- **Temporizador:** 15/30/45/60 minutos o tiempo personalizado; atenuación temporal y parada automática.
- **Deshacer/Rehacer:** canciones agregadas/eliminadas/movidas, nombres, copias y eliminación de playlists; Ctrl+Z, Ctrl+Y o Ctrl+Mayús+Z. Crear una playlist no entra en el historial.
- **Sin conexión:** conserva archivos explícitamente en IndexedDB y prepara recursos de producción con Service Worker; instalación PWA mediante el navegador cuando esté disponible.
- **Atajos:** Espacio, flechas, Ctrl+flechas y M fuera de campos/controles; ayuda visible en Atajos de teclado.

La cola tiene prioridad sobre repetición/avance, mantiene un ancla en la playlist y utiliza nodos propios. Deshacer/rehacer no modifica estados de audio, colas consumidas ni estadísticas. Más detalle en [docs/DATA_STRUCTURES.md](docs/DATA_STRUCTURES.md).

## Patrones y demostración

Consulta [PATTERNS.md](PATTERNS.md) para participantes, archivos y flujos.

| Patrón | Demostración |
| --- | --- |
| Builder | Crear playlist con nombre y descripción; comprobar rechazo de nombre vacío |
| Prototype | Duplicar playlist y eliminar/agregar canciones de la copia sin cambiar la original |
| Factory Method | Importar archivos de audio reales y comprobar sus títulos derivados del archivo |
| Abstract Factory | Iniciar la aplicación; `main.ts` compone la familia web a través de la factoría |
| Adapter | Importar y reproducir un File mediante una URL de objeto; eliminar recursos compartidos |
| Bridge | Elegir los tres modos y esperar al final de una canción |
| Decorator | Activar entrada gradual y refuerzo, individualmente y combinados |
| Command | Agregar, mover o eliminar y usar Deshacer/Rehacer; una acción nueva limpia Rehacer |

## Verificaciones y compilación

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Las pruebas de navegador son independientes de Vitest:

```bash
npx playwright install chromium
npm run test:e2e
```

En Linux deben estar disponibles las bibliotecas del navegador. En esta sesión se descargaron exclusivamente dentro del proyecto; para reutilizarlas:

```bash
export PATH="$PWD/.tools/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/browsers"
export LD_LIBRARY_PATH="$PWD/.tools/browser-libs/usr/lib/x86_64-linux-gnu"
npm run test:e2e
```

Playwright genera WAV PCM en memoria, usa el elemento audio real y prueba escritorio/móvil. No agrega música de demostración a la aplicación.

`npm test` ejecuta Vitest con jsdom. Las pruebas incluyen los 16 casos de la lista solicitados, recorridos inversos, posiciones inválidas, 500 operaciones mixtas deterministas, clones independientes, recursos compartidos, importación, repetición, decoradores, persistencia y servicios. El audio se sustituye por una salida controlada en las pruebas unitarias; jsdom no decodifica audio real. La auditoría original [AUDIT.md](AUDIT.md) conserva el estado previo a la ampliación. El informe de la ampliación anterior [docs/TEST_REPORT.md](docs/TEST_REPORT.md) conserva sus resultados; [docs/LOCAL_FINAL_AUDIT.md](docs/LOCAL_FINAL_AUDIT.md) contiene la auditoría vigente y [docs/MANUAL_QA.md](docs/MANUAL_QA.md) enumera comprobaciones humanas pendientes.

`npm run build` ejecuta TypeScript estricto y produce `dist/`. `npm run preview` sirve esa compilación normalmente en `http://localhost:4173`. No abras `index.html` directamente por el protocolo file:.

## Persistencia y limitaciones reales

La configuración básica usa `localStorage`. En el panel **Sin conexión** puedes conservar explícitamente canciones como blobs en **IndexedDB**; sus playlists, UUID, orden y selección se recuperan al abrir de nuevo. Las canciones no autorizadas no conservan su archivo y debes seleccionarlas otra vez. Las URLs temporales nunca se persisten: se reconstruyen desde los blobs. Las estadísticas también se guardan en IndexedDB. El almacenamiento pertenece a este navegador y origen; puede agotarse o ser eliminado por el navegador. La denegación de persistencia no impide escuchar durante la sesión. No hay almacenamiento cloud, biblioteca pública, cuentas, APIs remotas ni acceso automático al disco.

Los archivos se reproducen mediante Object URLs, sin subida. Cada fuente cuenta sus propietarios; al eliminar el último se revoca la URL. Antes de liberar una canción actual se detiene y desconecta el elemento audio. Al abandonar la página se liberan listas y reproducción; se respeta la caché de navegación del navegador.

Se leen etiquetas ID3v2.3/v2.4 sin compresión ni unsynchronization, WAV INFO y FLAC Vorbis cuando están presentes dentro de los primeros 2 MiB del archivo. Los formatos no cubiertos y etiquetas ausentes/corruptas conservan el título derivado del archivo y muestran **Artista desconocido**. No se consulta Internet para completar datos. La duración se obtiene cuando se selecciona una canción. El refuerzo ajusta el volumen del elemento, no realiza DSP ni amplifica por encima de 1. Si el navegador deniega almacenamiento, el reproductor sigue funcionando en memoria. La pestaña debe permanecer disponible para la reproducción; las políticas de suspensión y autoplay dependen del navegador.

La tipografía usa fuentes locales del sistema; no carga recursos desde servicios externos. El proyecto no necesita imágenes ni bibliotecas externas de iconos. Los componentes se pueden usar con teclado y presentan labels, foco visible, estados disabled y mensajes accesibles. El panel de nodos y las operaciones musicales están disponibles en escritorio y móvil.

## Verificar el modo sin conexión en producción

```bash
npm run build
npm run preview
```

Abre `http://localhost:4173`, importa un archivo, entra en Sin conexión y pulsa **Conservar canciones de esta playlist** y **Preparar modo sin conexión**. Después desconecta la red y recarga. Solo se recuperan audios guardados. Usa HTTPS al publicar; localhost permite las pruebas locales. El Service Worker no se registra durante `npm run dev`.

Para ejecutar todas las pruebas Chromium sobre producción, con el navegador instalado:

```bash
npm run build
SONARIS_PRODUCTION_TEST=1 npm run test:e2e
```

En PowerShell, establece `$env:SONARIS_PRODUCTION_TEST="1"` antes de ejecutar `npm run test:e2e`. La suite de desarrollo omite los escenarios que requieren Service Worker de producción.

## Despliegue manual de la aplicación estática

Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para los pasos completos y un flujo manual de GitHub Actions.

No se hicieron commits ni despliegues. `base: './'` permite alojar la compilación bajo una subruta. Mi música no requiere credenciales. Spotify opcional usa dos variables públicas VITE; consulta las condiciones de callback en [DEPLOYMENT.md](DEPLOYMENT.md).

- **Netlify:** ejecuta `npm run build`; en tu panel usa la carga manual de sitios y sube `dist/`. Si conectas un repositorio que tú hayas publicado, configura comando `npm run build` y directorio `dist`.
- **Vercel:** publica tú el repositorio y elige importar proyecto en tu cuenta. Selecciona Vite, instalación `npm ci`, compilación `npm run build` y salida `dist`. Confirma el despliegue en el panel.
- **Cloudflare Pages:** en tu cuenta crea un proyecto Pages con carga directa y sube `dist/`, o conecta tu repositorio con comando `npm run build` y salida `dist`.
- **GitHub Pages:** crea tú un repositorio y publica el código. Genera `dist` con `npm ci` y `npm run build`. Configura un flujo GitHub Actions para subir `dist` con `actions/upload-pages-artifact` y desplegar con `actions/deploy-pages`; en Settings → Pages selecciona GitHub Actions. También puedes publicar el contenido compilado en una rama y seleccionarla en Pages. La base relativa admite la ruta del repositorio.

Usa Node 22 en la configuración de compilación de la plataforma. Tras publicar, abre el enlace HTTPS e importa una canción para comprobar reproducción, navegación y permisos en tu navegador. Las playlists de localhost no se transfieren al nuevo origen.

## Equipo

Autor / integrantes: **pendiente de completar**.
Materia: **Estructuras de Datos / Patrones de Software**.
Institución, docente y grupo: **pendientes de completar**.
