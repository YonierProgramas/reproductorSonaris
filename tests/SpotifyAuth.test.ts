import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { SpotifyAuthService, createPkce, spotifyScopes } from '../src/spotify/SpotifyAuthService';
import { SpotifyApiClient } from '../src/spotify/SpotifyApiClient';
import { timedFetch } from '../src/spotify/SpotifyError';
const config = { clientId: 'ce80cd6caaad49fb87bf511aaf07e369', redirectUri: 'http://127.0.0.1:5173/callback' };
const tokens = (suffix = '') => ({ access_token: 'mock-access' + suffix, refresh_token: 'mock-refresh' + suffix, expires_in: 3600, token_type: 'Bearer', scope: spotifyScopes.join(' ') });
const services: SpotifyAuthService[] = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => { services.splice(0).forEach(auth => auth.dispose()); vi.useRealTimers(); });
function setup(request = vi.fn<typeof fetch>(async url => String(url).includes('/api/token') ? Response.json(tokens()) : Response.json({ id: 'allowed-user', display_name: '<Test user>' }))) {
  const navigate = vi.fn(), replaceUrl = vi.fn(); let now = 100000;
  const auth = new SpotifyAuthService(config, { request, storage: sessionStorage, crypto: webcrypto as unknown as Crypto, navigate, replaceUrl, origin: 'http://127.0.0.1:5173', now: () => now }); services.push(auth);
  return { auth, request, navigate, replaceUrl, setNow: (value: number) => { now = value; } };
}
async function authorize(auth: SpotifyAuthService): Promise<void> {
  await auth.connect(); const record = JSON.parse(sessionStorage.getItem('sonaris.spotify.pkce')!); await auth.handleCallback(new URL(`${config.redirectUri}?code=mock-code&state=${record.state}`));
}
describe('Official PKCE flow with mocked responses', () => {
  it('uses the exact production redirect for authorization and code exchange', async () => {
    const redirectUri = 'https://reproductor-sonoris.vercel.app/callback';
    const navigate = vi.fn(), replaceUrl = vi.fn();
    const request = vi.fn<typeof fetch>(async url => String(url).includes('/api/token') ? Response.json(tokens()) : Response.json({ id: 'allowed-user' }));
    const auth = new SpotifyAuthService({ ...config, redirectUri }, { request, storage: sessionStorage, crypto: webcrypto as unknown as Crypto, navigate, replaceUrl, origin: new URL(redirectUri).origin });
    services.push(auth);
    await auth.connect();
    const authorization = new URL(navigate.mock.calls[0][0]);
    expect(authorization.searchParams.get('redirect_uri')).toBe(redirectUri);
    const code = 'production+code/with=characters';
    const callback = new URL(redirectUri);
    callback.search = new URLSearchParams({ code, state: authorization.searchParams.get('state')! }).toString();
    expect(await auth.handleCallback(callback)).toBe(true);
    expect(auth.connected).toBe(true);
    expect(replaceUrl).toHaveBeenCalledWith('/');
    const exchange = new URLSearchParams(request.mock.calls[0][1]!.body as URLSearchParams);
    expect(exchange.get('code')).toBe(code);
    expect(exchange.get('redirect_uri')).toBe(redirectUri);
    expect(sessionStorage.getItem('sonaris.spotify.pkce')).toBeNull();
  });
  it('generates secure verifier, SHA-256 challenge and independent state', async () => {
    const pkce = await createPkce(webcrypto as unknown as Crypto), another = await createPkce(webcrypto as unknown as Crypto); expect(pkce.verifier).toMatch(/^[\w-]{43,128}$/); expect(pkce.state).toMatch(/^[\w-]{43}$/); expect(pkce.verifier).not.toBe(another.verifier);
    expect(pkce.challenge).toBe(Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(pkce.verifier))).toString('base64url'));
  });
  it('keeps construction safe when session storage is blocked and reports connection failure', async () => {
    const denied = () => { throw new DOMException('Blocked', 'SecurityError'); };
    const auth = new SpotifyAuthService(config, { origin: 'http://127.0.0.1:5173', crypto: webcrypto as unknown as Crypto, storage: { getItem: denied, setItem: denied, removeItem: denied }, navigate: () => {} }); services.push(auth);
    expect(auth.connected).toBe(false); await expect(auth.connect()).rejects.toThrow(); expect(auth.state).toBe('error'); expect(auth.status).toContain('almacenamiento de sesión'); expect(() => auth.disconnect()).not.toThrow();
  });
  it('preserves one-use PKCE across page disposal while explicit disconnect removes it', async () => {
    const { auth, navigate } = setup(); await auth.connect(); const state = new URL(navigate.mock.calls[0][0]).searchParams.get('state');
    auth.dispose(); expect(sessionStorage.getItem('sonaris.spotify.pkce')).not.toBeNull();
    const next = setup().auth; await next.handleCallback(new URL('http://127.0.0.1:5173/callback?code=mock&state=' + state));
    expect(next.connected).toBe(true); expect(sessionStorage.getItem('sonaris.spotify.pkce')).toBeNull();
    await next.connect(); next.disconnect(); expect(sessionStorage.getItem('sonaris.spotify.pkce')).toBeNull();
  });
  it('stores only the transaction, uses minimal scopes and never puts tokens in the redirect', async () => {
    const { auth, navigate } = setup(); await auth.connect(); const url = new URL(navigate.mock.calls[0][0]); expect(url.origin).toBe('https://accounts.spotify.com'); expect(url.searchParams.get('scope')?.split(' ')).toEqual(spotifyScopes); expect(url.searchParams.has('client_secret')).toBe(false); expect(url.searchParams.has('access_token')).toBe(false); expect(sessionStorage.length).toBe(1); expect(sessionStorage.getItem('sonaris.spotify.pkce')).not.toContain('access_token');
  });
  it('validates callback, erases code before requests and confirms account authorization', async () => {
    const { auth, request, replaceUrl } = setup(); await authorize(auth); expect(auth.connected).toBe(true); expect(auth.displayName).toBe('<Test user>'); expect(replaceUrl).toHaveBeenCalledWith('/'); expect(sessionStorage.length).toBe(0); expect(request).toHaveBeenCalledTimes(2); const params = new URLSearchParams(request.mock.calls[0][1]!.body as URLSearchParams); expect(params.get('code_verifier')).toMatch(/^[\w-]{43,128}$/); expect(params.get('client_secret')).toBeNull(); expect(await auth.getAccessToken()).toBe('mock-access');
  });
  it('rejects mismatched state, missing transaction and callback replay without sending requests', async () => {
    const { auth, request, replaceUrl } = setup(); await auth.connect(); await auth.handleCallback(new URL(config.redirectUri + '?code=mock&state=wrong')); expect(auth.connected).toBe(false); expect(request).not.toHaveBeenCalled(); expect(replaceUrl).toHaveBeenCalled(); await auth.handleCallback(new URL(config.redirectUri + '?code=mock&state=wrong')); expect(request).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0);
  });
  it('rejects expired transactions and user denial while preserving the local app contract', async () => {
    const { auth, request, setNow } = setup(); await auth.connect(); const record = JSON.parse(sessionStorage.getItem('sonaris.spotify.pkce')!); setNow(800000); await auth.handleCallback(new URL(config.redirectUri + '?code=mock&state=' + record.state)); expect(request).not.toHaveBeenCalled(); expect(auth.state).toBe('error');
    await auth.connect(); const next = JSON.parse(sessionStorage.getItem('sonaris.spotify.pkce')!); await auth.handleCallback(new URL(config.redirectUri + '?error=access_denied&state=' + next.state)); expect(auth.status).toContain('cancelada'); expect(request).not.toHaveBeenCalled();
  });
  it('requires a matching loopback/HTTPS origin and rejects insecure or malformed configuration', () => {
    const { auth } = setup(); expect(auth.canConnect).toBe(true); const mismatch = new SpotifyAuthService(config, { origin: 'http://localhost:5173' }); services.push(mismatch); expect(mismatch.canConnect).toBe(false);
    for (const redirectUri of ['http://example.com/callback', 'http://localhost:5173/callback', 'https://user:pass@example.com/callback', 'https://example.com/callback?token=x']) { const invalid = new SpotifyAuthService({ ...config, redirectUri }); services.push(invalid); expect(invalid.configured).toBe(false); }
  });
  it('does not mark a rejected account or malformed token response as connected', async () => {
    const rejected = setup(vi.fn<typeof fetch>(async url => String(url).includes('/api/token') ? Response.json(tokens()) : new Response('', { status: 403 }))); await authorize(rejected.auth); expect(rejected.auth.connected).toBe(false); await expect(rejected.auth.getAccessToken()).rejects.toThrow();
    const invalid = setup(vi.fn<typeof fetch>(async () => Response.json({ access_token: 'mock' }))); await authorize(invalid.auth); expect(invalid.auth.state).toBe('error');
  });
  it('refreshes once for concurrent callers, rotates refresh token and clears memory on disconnect', async () => {
    const { auth, request, setNow } = setup(); await authorize(auth); setNow(3700000); request.mockImplementation(async () => Response.json(tokens('-new'))); const results = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]); expect(results).toEqual(['mock-access-new', 'mock-access-new']); expect(request).toHaveBeenCalledTimes(3); expect(new URLSearchParams(request.mock.calls[2][1]!.body as URLSearchParams).get('refresh_token')).toBe('mock-refresh'); auth.disconnect(); expect(auth.state).toBe('disconnected'); expect(sessionStorage.length).toBe(0); await expect(auth.getAccessToken()).rejects.toThrow();
  });
  it('expires the session on refresh rejection and does not resurrect tokens after disconnect', async () => {
    const { auth, request, setNow } = setup(); await authorize(auth); setNow(3700000); request.mockResolvedValue(new Response('', { status: 400 })); await expect(auth.getAccessToken()).rejects.toThrow(); expect(auth.state).toBe('expired');
    const another = setup(); await authorize(another.auth); let resolve!: (response: Response) => void; another.request.mockImplementation(() => new Promise<Response>(done => { resolve = done; })); const renewal = another.auth.getAccessToken(true); await Promise.resolve(); another.auth.disconnect(); resolve(Response.json(tokens('-late'))); await expect(renewal).rejects.toThrow(); expect(another.auth.connected).toBe(false);
  });
});
describe('Spotify API isolation and HTTP handling', () => {
  it('retries 401 exactly once after renewal, then expires invalid sessions', async () => {
    const { auth } = setup(); await authorize(auth); const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(Response.json({ ok: true })); const api = new SpotifyApiClient(auth, request); expect(await api.call('/search?q=test')).toEqual({ ok: true }); expect(request).toHaveBeenCalledTimes(2);
    request.mockImplementation(async () => new Response('', { status: 401 })); await expect(api.call('/search?q=test')).rejects.toMatchObject({ code: 'authentication' }); expect(auth.state).toBe('expired');
  });
  it('reports 403, respects Retry-After and avoids requests during the quota cooldown', async () => {
    const { auth } = setup(); await authorize(auth); let now = 100; const request = vi.fn<typeof fetch>(async () => new Response('', { status: 403 })), api = new SpotifyApiClient(auth, request, () => now);
    await expect(api.call('/search?q=test')).rejects.toMatchObject({ code: 'forbidden', status: 403 }); request.mockImplementation(async () => new Response('', { status: 429, headers: { 'Retry-After': '5' } })); await expect(api.call('/search?q=test')).rejects.toMatchObject({ code: 'quota', retryAfter: 5 }); await expect(api.call('/search?q=test')).rejects.toMatchObject({ code: 'quota' }); expect(request).toHaveBeenCalledTimes(2); now += 6000; request.mockImplementation(async () => Response.json({ ok: true })); expect(await api.call('/search?q=test')).toEqual({ ok: true });
  });
  it('blocks foreign paths and cancels requests when the session disconnects', async () => {
    const { auth } = setup(); await authorize(auth); const request = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))), api = new SpotifyApiClient(auth, request);
    await expect(api.call('https://evil.example')).rejects.toThrow(); const pending = api.call('/search?q=test'); await Promise.resolve(); await Promise.resolve(); auth.disconnect(); await expect(pending).rejects.toThrow();
  });
  it('caps concurrency and uses a timeout without exposing remote error contents', async () => {
    vi.useFakeTimers(); const request = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('private-server-detail')))));
    const pending = timedFetch(request, 'https://api.spotify.com/v1/search', {}); const rejection = expect(pending).rejects.toMatchObject({ code: 'timeout', message: 'Spotify tardó demasiado en responder.' }); await vi.advanceTimersByTimeAsync(12000); await rejection;
    vi.useRealTimers(); const { auth } = setup(); await authorize(auth); const never = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abort'))))), api = new SpotifyApiClient(auth, never); const calls = [api.call('/search'), api.call('/search'), api.call('/search')]; const failures = calls.map(call => call.catch(() => undefined)); await expect(api.call('/search')).rejects.toMatchObject({ code: 'quota' }); auth.disconnect(); await Promise.all(failures);
  });
});
