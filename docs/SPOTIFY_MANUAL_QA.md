# QA manual con una cuenta real

**Pendiente de intervención del propietario.** Las pruebas automatizadas de OAuth, API y SDK utilizan mocks declarados; no confirman una conexión, cuota ni audio real de Spotify. No se ingresó a ninguna cuenta ni se publicó el proyecto.

## Antes de empezar

- [ ] Verificar que el Client ID pertenece a la app correcta en el Dashboard.
- [ ] Registrar `http://127.0.0.1:5173/callback` exactamente y comprobar usuarios autorizados/restricciones de la app.
- [ ] Confirmar Premium de la cuenta reproductora y requisitos del propietario en Development Mode.
- [ ] Ejecutar `bash tools/run-local.sh dev` y abrir `http://127.0.0.1:5173/`.
- [ ] Conservar explícitamente archivos locales antes de navegar para autorizar.

## Consentimiento y sesión

- [ ] Abrir Explorar Spotify, conectar y completar el consentimiento oficial.
- [ ] Confirmar retorno sin code/state visibles y mensaje Spotify conectado.
- [ ] Cancelar el consentimiento en un intento nuevo; comprobar mensaje de rechazo y biblioteca local operativa.
- [ ] Mantener la sesión abierta hasta una renovación y comprobar continuidad sin copiar tokens.
- [ ] Desconectar: resultados, nombre, referencias y dispositivo desaparecen; Mi música sigue operativa.
- [ ] Recargar y comprobar que la sesión requiere nueva autorización y no existen tokens persistidos.

## Catálogo real

- [ ] Buscar canciones, artistas y álbumes y comparar enlaces/títulos con Spotify.
- [ ] Probar páginas anterior/siguiente, consulta sin resultados y cambio rápido de consulta.
- [ ] Explorar álbumes de un artista y canciones de un álbum.
- [ ] Guardar, mover y eliminar referencias de sesión; verificar independencia de las playlists locales.
- [ ] Ante 403 real, confirmar el mensaje de restricciones y no asumir endpoint disponible. No provocar tráfico abusivo para obtener 429; validar Retry-After cuando ocurra naturalmente.

## SDK y audio audible

- [ ] Esperar dispositivo listo y comprobar que aparece Sonaris — Spotify entre dispositivos.
- [ ] Reproducir una canción real; confirmar audio audible y coincidencia de título/progreso.
- [ ] Verificar pausa, reanudación, seek y volumen cuando el dispositivo los permita.
- [ ] Probar anterior/siguiente solo cuando el contexto no los marque restringidos.
- [ ] Si el navegador bloquea autoplay, pulsar Reanudar Spotify y verificar recuperación.
- [ ] Comprobar mensajes ante DRM/navegador no compatible y cuenta sin Premium, si se dispone de esos entornos.

## Exclusividad y regresiones

- [ ] Empezar con un archivo local, iniciar Spotify y comprobar que el archivo se pausa y su temporizador se cancela.
- [ ] Verificar controles locales de efectos/transporte deshabilitados mientras Spotify está activo.
- [ ] Volver a Mi música o reproducir un archivo local; comprobar pausa/desconexión del SDK antes de escuchar el archivo.
- [ ] Alternar rápidamente ambas fuentes; no debe continuar audio remoto tras una solicitud cancelada.
- [ ] Iniciar el dispositivo desde Spotify Connect estando en modo local; Sonaris debe pausar ambas fuentes para impedir reproducción simultánea sostenida.
- [ ] Confirmar que estadísticas locales no aumentan por Spotify y que EQ, visualizador, fade y boost no afectan al SDK.
- [ ] Generar radio local, guardar playlist automática y comprobar nodos/orden/deduplicación; nunca aparecen referencias Spotify en ella.
- [ ] Comprobar offline con archivos conservados en build de producción; Spotify requiere red y autorización.

## Publicación futura

- [ ] Configurar redirect HTTPS definitivo, registrar URL exacta, recompilar y verificar fallback de `/callback` y assets.
- [ ] Probar con Chrome/Edge/Firefox/Safari según disponibilidad y con pantalla móvil; las pruebas automáticas actuales usan Chromium Linux, sin validar compatibilidad DRM entre navegadores.
- [ ] Completar datos académicos (integrantes, docente e institución) que siguen pendientes en README.

Registra fecha, navegador, cuenta/plan sin secretos, resultado y errores para cada comprobación. No pegues tokens ni códigos de autorización en capturas públicas o informes.
