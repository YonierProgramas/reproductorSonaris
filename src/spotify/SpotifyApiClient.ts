import type { SpotifyAuthService } from './SpotifyAuthService';
import { SpotifyError, timedFetch } from './SpotifyError';
export class SpotifyApiClient {
  private recent: number[] = [];
  private concurrent = 0;
  private blockedUntil = 0;
  constructor(private readonly auth: SpotifyAuthService, private readonly request: typeof fetch = (...args) => fetch(...args), private readonly now: () => number = Date.now) {}
  async call<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://') || path.includes('\\')) throw new SpotifyError('response', 'Ruta de Spotify inválida.');
    signal?.throwIfAborted(); const now = this.now(); this.recent = this.recent.filter(time => now - time < 30000);
    if (now < this.blockedUntil) throw new SpotifyError('quota', 'La cuota de Spotify está en espera. Inténtalo más tarde.', 429, Math.ceil((this.blockedUntil - now) / 1000));
    if (this.concurrent >= 3 || this.recent.length >= 25) throw new SpotifyError('quota', 'Demasiadas solicitudes. Espera antes de volver a buscar.');
    this.concurrent++; this.recent.push(now); const controller = new AbortController(), sessionSignal = this.auth.signal;
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true }); sessionSignal.addEventListener('abort', abort, { once: true });
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const token = await this.auth.getAccessToken(attempt === 1); controller.signal.throwIfAborted();
        const response = await timedFetch(this.request, `https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, controller.signal);
        if (response.status === 401 && !attempt) continue;
        if (response.status === 401) { this.auth.expire(); throw new SpotifyError('authentication', 'Sesión caducada. Reconecta Spotify.', 401); }
        if (response.status === 403) throw new SpotifyError('forbidden', 'Spotify no permite esta operación para la cuenta, aplicación o permisos actuales.', 403);
        if (response.status === 429) { const seconds = Math.max(1, Math.min(86400, Number(response.headers.get('Retry-After')) || 30)); this.blockedUntil = this.now() + seconds * 1000; throw new SpotifyError('quota', `Spotify alcanzó su cuota. Espera ${seconds} segundos.`, 429, seconds); }
        if (!response.ok) throw new SpotifyError(response.status === 404 ? 'device' : 'response', response.status === 404 ? 'El dispositivo o contenido de Spotify no está disponible.' : `Spotify rechazó la operación (${response.status}).`, response.status);
        if (response.status === 204 || response.headers.get('Content-Length') === '0') return undefined as T;
        const data = await response.text(); if (!data) return undefined as T;
        try { return JSON.parse(data) as T; } catch { throw new SpotifyError('response', 'Spotify devolvió una respuesta inválida.'); }
      }
      throw new SpotifyError('authentication', 'Reconecta Spotify.');
    } finally { this.concurrent--; signal?.removeEventListener('abort', abort); sessionSignal.removeEventListener('abort', abort); }
  }
}
