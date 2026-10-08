# Autenticación y activación de Spotify

## Configuración pública preparada

`.env.local` contiene el Client ID público proporcionado en el documento aprobado y está ignorado; `.env.example` permite reproducir la configuración:

```dotenv
VITE_SPOTIFY_CLIENT_ID=ce80cd6caaad49fb87bf511aaf07e369
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
```

No se necesita Client Secret ni backend. Nunca añadas contraseñas, Client Secret, access_token o refresh_token a variables VITE: su contenido se incorpora al JavaScript público. Un Client ID es público; su presencia no demuestra que la app del Dashboard esté activa o autorice una cuenta.

## Acciones del propietario en el Dashboard

1. Abre el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) con la cuenta propietaria y selecciona la aplicación correspondiente al Client ID. Si no eres su propietario, usa una app propia y sustituye únicamente el Client ID público.
2. En su configuración registra **exactamente** `http://127.0.0.1:5173/callback`. Guarda los cambios. Spotify admite HTTP para loopback IP explícita; `localhost` no sirve como sustitución del redirect. Para un sitio remoto utiliza HTTPS.
3. Revisa Development Mode y los usuarios permitidos. Las reglas anunciadas en 2026 para nuevas aplicaciones incluyen Premium del propietario, un Client ID y hasta cinco usuarios permitidos. Comprueba las restricciones efectivas de tu app en el Dashboard; no se pudo auditar tu cuenta privada. Añade la cuenta que probará Sonaris si corresponde.
4. Usa una cuenta Premium para el Web Playback SDK. Permite reproducción de contenido protegido en un navegador compatible. No se infiere Premium leyendo `/me.product`; el SDK informa `account_error`.
5. Si cambias las variables reinicia Vite. Las variables se fijan durante el build: vuelve a compilar para cambiar un sitio estático.

## Ejecutar y conectar

```bash
cd /mnt/c/proyectos/sonaris
bash tools/run-local.sh dev
```

Abre **http://127.0.0.1:5173/**. El puerto está fijado y `strictPort` evita un cambio silencioso. No conectes desde `localhost:5173` ni desde preview `4173` con el redirect actual: Sonaris deshabilita el botón cuando el origen no coincide.

Antes de autorizar, conserva los archivos locales deseados desde **Sin conexión → Conservar canciones de esta playlist**. La autorización navega fuera de la página; los File/Object URL no guardados no sobreviven. La biblioteca conservada se restaura al retornar al mismo origen.

Pulsa **Explorar Spotify → Conectar con Spotify**, inicia sesión directamente en Spotify y acepta el consentimiento. Sonaris genera un verifier criptográfico, challenge S256 y state aleatorio. Tras regresar, valida transacción/origen/estado/caducidad, consume la transacción y borra los parámetros de la URL antes de intercambiar el código. Solo muestra **Spotify conectado** después de verificar `/me`.

El SDK se inicia después de la autorización; espera **Dispositivo listo**, busca una canción y pulsa **Reproducir en Spotify**. El mensaje **Reproduciendo en Spotify** procede del estado del SDK. Que no haya error de autorización o que un endpoint responda 204 no confirma audio audible. Comprueba la salida de sonido personalmente.

## Permisos mínimos solicitados

| Scope | Motivo |
| --- | --- |
| `streaming` | Reproducción mediante Web Playback SDK |
| `user-read-email` | Permiso requerido por la configuración oficial del SDK; Sonaris no muestra ni conserva el correo |
| `user-read-private` | Permiso requerido por la configuración oficial del SDK y verificación de la sesión |
| `user-modify-playback-state` | Iniciar una URI en el dispositivo oficial mediante PUT `/me/player/play` |

No se solicitan permisos de escritura de playlists, biblioteca, historial, recomendaciones ni lectura del estado Web API. El estado proviene del SDK. La colección enlazada de referencias no requiere modificar la cuenta.

## Sesión y revocación

Access token y refresh token solo están en memoria; refresh es single-flight, se renueva antes de caducar y admite rotación. La sesión no sobrevive a una recarga: conecta de nuevo. No se usa localStorage/IndexedDB/caché para tokens. **Desconectar Spotify** cancela solicitudes, libera SDK/listeners/intervalos y borra resultados, nombre y referencias; la biblioteca local queda disponible. Para revocar también el permiso concedido al servicio, elimina el acceso de Sonaris desde la gestión de aplicaciones de tu cuenta Spotify.

## Problemas habituales

| Estado visible | Acción manual |
| --- | --- |
| Origen no coincide | Abre 127.0.0.1:5173; verifica redirect exacto y reinicia Vite |
| Respuesta no válida o caducada | Inicia una conexión nueva; no reutilices callback/código |
| Cuenta no autorizada / 403 | Revisa usuario permitido, consentimiento, app y restricciones del Dashboard |
| Se requiere Spotify Premium | Revisa el plan de la cuenta y requisitos de la app |
| Sesión caducada | Reconecta; no pegues tokens manualmente |
| Cuota / 429 | Espera el Retry-After mostrado; reduce búsquedas |
| Dispositivo no disponible / reproducción fallida | Reactiva el reproductor, revisa red, DRM, navegador y restricciones regionales |
| Autoplay bloqueado | Pulsa Reanudar Spotify o selecciona el dispositivo en Spotify |

Referencias: [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [SDK y scopes](https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player), [redirects](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [reglas 2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security). No compartas secretos ni tokens con el agente.
