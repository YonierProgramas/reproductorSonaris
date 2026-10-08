import { SpotifyError, timedFetch } from './SpotifyError';
export interface SpotifyConfiguration { clientId: string; redirectUri: string; }
export type AuthState = 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error';
export const spotifyScopes = Object.freeze(['streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state']);
const transactionKey = 'sonaris.spotify.pkce';
const base64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function createPkce(cryptoApi: Crypto = crypto): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifier = base64Url(cryptoApi.getRandomValues(new Uint8Array(64)));
  const challenge = base64Url(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, challenge, state: base64Url(cryptoApi.getRandomValues(new Uint8Array(32))) };
}
interface TokenResponse { access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string; }
interface AuthOptions { request?: typeof fetch; crypto?: Crypto; storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; now?: () => number; origin?: string; navigate?: (url: string) => void; replaceUrl?: (path: string) => void; }
export class SpotifyAuthService extends EventTarget {
  state: AuthState = 'disconnected';
  status = 'Conecta tu cuenta para explorar Spotify.';
  displayName = '';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;
  private revision = 0;
  private lifecycle = new AbortController();
  private refreshPending: Promise<string> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly request: typeof fetch;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  private readonly now: () => number;
  private readonly cryptoApi: Crypto;
  private readonly origin: string;
  private readonly navigate: (url: string) => void;
  private readonly replaceUrl: (path: string) => void;
  constructor(readonly configuration: SpotifyConfiguration, options: AuthOptions = {}) {
    super(); this.request = options.request ?? ((...args) => fetch(...args)); this.cryptoApi = options.crypto ?? crypto; this.storage = options.storage ?? { getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value), removeItem: key => window.sessionStorage.removeItem(key) }; this.now = options.now ?? Date.now; this.origin = options.origin ?? location.origin; this.navigate = options.navigate ?? (url => location.assign(url)); this.replaceUrl = options.replaceUrl ?? (path => history.replaceState(null, '', path));
  }
  get configured(): boolean {
    try { const redirect = new URL(this.configuration.redirectUri); return /^[a-f\d]{32}$/i.test(this.configuration.clientId) && !redirect.username && !redirect.password && !redirect.search && !redirect.hash && !redirect.pathname.endsWith('/') && (redirect.protocol === 'https:' || redirect.protocol === 'http:' && redirect.hostname === '127.0.0.1'); } catch { return false; }
  }
  get canConnect(): boolean { return this.configured && new URL(this.configuration.redirectUri).origin === this.origin; }
  get connected(): boolean { return this.state === 'connected'; }
  get signal(): AbortSignal { return this.lifecycle.signal; }
  private notify(): void { this.dispatchEvent(new Event('change')); }
  async connect(): Promise<void> {
    if (!this.canConnect) throw new SpotifyError('configuration', 'Abre Sonaris en el origen de la Redirect URI configurada. Revisa .env.local y el Dashboard de Spotify.');
    this.clearSession(); const revision = this.revision; this.state = 'connecting'; this.status = 'Conectando…'; this.notify();
    try {
      const pkce = await createPkce(this.cryptoApi); if (revision !== this.revision) throw new SpotifyError('cancelled', 'Conexión cancelada.');
      this.storage.setItem(transactionKey, JSON.stringify({ verifier: pkce.verifier, state: pkce.state, created: this.now(), redirectUri: this.configuration.redirectUri }));
      const url = new URL('https://accounts.spotify.com/authorize'); url.search = new URLSearchParams({ client_id: this.configuration.clientId, response_type: 'code', redirect_uri: this.configuration.redirectUri, code_challenge_method: 'S256', code_challenge: pkce.challenge, state: pkce.state, scope: spotifyScopes.join(' ') }).toString(); this.navigate(url.href);
    } catch (error) { if (revision === this.revision) { this.state = 'error'; this.status = 'No fue posible conectar Spotify. El navegador debe permitir almacenamiento de sesión y Web Crypto.'; this.notify(); } throw error; }
  }
  async handleCallback(url = new URL(location.href)): Promise<boolean> {
    if (!this.configured || url.pathname !== new URL(this.configuration.redirectUri).pathname) return false;
    // Remove authorization code/state before the first network request, including on errors.
    const home = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1); this.replaceUrl(home);
    let stored: string | null = null;
    try { stored = this.storage.getItem(transactionKey); this.storage.removeItem(transactionKey); } catch { /* Validation below fails closed. */ }
    const revision = this.revision; this.state = 'connecting'; this.status = 'Conectando…'; this.notify();
    try {
      const record = stored ? JSON.parse(stored) as Record<string, unknown> : null;
      if (url.origin !== this.origin || !this.canConnect || !record || record.redirectUri !== this.configuration.redirectUri || typeof record.created !== 'number' || this.now() - record.created < 0 || this.now() - record.created > 600000 || typeof record.verifier !== 'string' || !/^[A-Za-z\d_-]{43,128}$/.test(record.verifier) || typeof record.state !== 'string' || !/^[A-Za-z\d_-]{43}$/.test(record.state) || record.state !== url.searchParams.get('state')) throw new SpotifyError('authentication', 'La respuesta de autorización no es válida o ya caducó. Reconecta Spotify.');
      if (url.searchParams.has('error')) throw new SpotifyError('authentication', 'No fue posible conectar Spotify: la autorización fue cancelada o rechazada.');
      const code = url.searchParams.get('code'); if (!code || code.length > 4096) throw new SpotifyError('authentication', 'Spotify no devolvió un código de autorización válido.');
      const tokens = await this.tokenRequest({ grant_type: 'authorization_code', code, code_verifier: record.verifier, redirect_uri: this.configuration.redirectUri });
      if (revision !== this.revision) throw new SpotifyError('cancelled', 'Conexión cancelada.'); this.acceptTokens(tokens);
      const response = await timedFetch(this.request, 'https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${this.accessToken}` } }, this.signal);
      if (!response.ok) throw new SpotifyError('authentication', 'Spotify no autorizó esta cuenta. Comprueba los usuarios permitidos en Development Mode.');
      const profile = await response.json() as { id?: string; display_name?: string };
      if (!profile.id || revision !== this.revision) throw new SpotifyError('authentication', 'No se pudo verificar la sesión de Spotify.');
      this.displayName = typeof profile.display_name === 'string' ? profile.display_name.slice(0, 100) : ''; this.state = 'connected'; this.status = 'Spotify conectado'; this.scheduleRefresh(); this.notify();
    } catch (error) { if (revision === this.revision) { this.clearSession(); this.state = 'error'; this.status = error instanceof SpotifyError ? error.message : 'No fue posible conectar Spotify.'; this.notify(); } }
    return true;
  }
  private async tokenRequest(parameters: Record<string, string>): Promise<TokenResponse> {
    const response = await timedFetch(this.request, 'https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.configuration.clientId, ...parameters }) }, this.signal);
    if (!response.ok) throw new SpotifyError('authentication', 'Sesión caducada. Reconecta Spotify.', response.status);
    try { return await response.json() as TokenResponse; } catch { throw new SpotifyError('response', 'Spotify devolvió una respuesta de sesión inválida.'); }
  }
  private acceptTokens(tokens: TokenResponse): void {
    if (typeof tokens.access_token !== 'string' || !tokens.access_token || tokens.token_type?.toLowerCase() !== 'bearer' || typeof tokens.expires_in !== 'number' || !Number.isFinite(tokens.expires_in) || tokens.expires_in < 1 || tokens.expires_in > 86400) throw new SpotifyError('authentication', 'La respuesta de sesión de Spotify es inválida.');
    if (tokens.scope && spotifyScopes.some(scope => !tokens.scope!.split(' ').includes(scope))) throw new SpotifyError('authentication', 'Faltan permisos necesarios. Reconecta Spotify y acepta el consentimiento.');
    this.accessToken = tokens.access_token; if (typeof tokens.refresh_token === 'string' && tokens.refresh_token) this.refreshToken = tokens.refresh_token; this.expiresAt = this.now() + tokens.expires_in * 1000;
  }
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!this.connected || !this.accessToken) throw new SpotifyError('authentication', 'Conecta o reconecta Spotify para continuar.');
    if (!forceRefresh && this.expiresAt - this.now() > 30000) return this.accessToken;
    if (!this.refreshPending) { const pending = this.refresh(); this.refreshPending = pending; void pending.finally(() => { if (this.refreshPending === pending) this.refreshPending = null; }).catch(() => {}); } return this.refreshPending;
  }
  private async refresh(): Promise<string> {
    const revision = this.revision;
    try {
      if (!this.refreshToken) throw new SpotifyError('authentication', 'Sesión caducada. Reconecta Spotify.');
      const tokens = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.refreshToken });
      if (revision !== this.revision) throw new SpotifyError('cancelled', 'Sesión desconectada.'); this.acceptTokens(tokens); this.scheduleRefresh(); return this.accessToken!;
    } catch (error) { if (revision === this.revision) this.expire(); throw error; }
  }
  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer); this.refreshTimer = setTimeout(() => { this.refreshTimer = null; void this.getAccessToken(true).catch(() => {}); }, Math.max(1000, this.expiresAt - this.now() - 60000));
  }
  private clearSession(): void {
    this.revision++; this.lifecycle.abort(); this.lifecycle = new AbortController(); if (this.refreshTimer) clearTimeout(this.refreshTimer); this.refreshTimer = null; this.refreshPending = null; this.accessToken = null; this.refreshToken = null; this.expiresAt = 0; this.displayName = '';
  }
  expire(): void { this.clearSession(); this.state = 'expired'; this.status = 'Sesión caducada. Reconecta Spotify.'; this.notify(); }
  disconnect(): void { this.clearSession(); try { this.storage.removeItem(transactionKey); } catch { /* Memory tokens were already removed. */ } this.state = 'disconnected'; this.status = 'Spotify desconectado. Mi música sigue disponible.'; this.notify(); }
  dispose(): void {
    // Page navigation must preserve the one-use PKCE transaction for the OAuth return.
    // Explicit disconnect still removes it. Tokens and async work never survive disposal.
    this.clearSession(); this.state = 'disconnected'; this.notify();
  }
}
