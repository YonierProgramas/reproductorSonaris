export type SpotifyErrorCode = 'configuration' | 'authentication' | 'premium' | 'forbidden' | 'quota' | 'network' | 'timeout' | 'response' | 'device' | 'unsupported' | 'cancelled';
export class SpotifyError extends Error {
  constructor(readonly code: SpotifyErrorCode, message: string, readonly status?: number, readonly retryAfter?: number) { super(message); this.name = 'SpotifyError'; }
}
export const errorMessage = (error: unknown): string => error instanceof SpotifyError ? error.message : 'No se pudo completar la operación de Spotify. Inténtalo de nuevo.';
export async function timedFetch(request: typeof fetch, url: string, init: RequestInit, signal?: AbortSignal, timeoutMs = 12000): Promise<Response> {
  signal?.throwIfAborted(); const controller = new AbortController(); let expired = false;
  const abort = () => controller.abort(signal?.reason); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { expired = true; controller.abort(); }, timeoutMs);
  try { const response = await request(url, { ...init, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' }); const data = response.status === 204 ? null : await response.arrayBuffer(); return new Response(data, { status: response.status, statusText: response.statusText, headers: response.headers }); }
  catch { if (signal?.aborted) throw new SpotifyError('cancelled', 'Operación cancelada.'); throw new SpotifyError(expired ? 'timeout' : 'network', expired ? 'Spotify tardó demasiado en responder.' : 'No se pudo conectar con Spotify. Comprueba la red.'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
