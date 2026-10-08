import { test, expect, type Page } from '@playwright/test';
const production = process.env.SONARIS_PRODUCTION_TEST === '1';
const trackId = 'A'.repeat(22);
const scopes = 'streaming user-read-email user-read-private user-modify-playback-state';
const track = { id: trackId, uri: `spotify:track:${trackId}`, name: 'Pista de prueba <segura>', duration_ms: 180000, artists: [{ name: 'Artista de prueba' }], album: { name: 'Álbum de prueba', images: [] } };
function localWav() {
  const count = 8000 * 30, buffer = Buffer.alloc(44 + count * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) buffer.writeInt16LE(Math.round(Math.sin(i * Math.PI * 440 / 4000) * 1000), 44 + i * 2);
  return { name: 'Personal.wav', mimeType: 'audio/wav', buffer };
}
async function mockSpotify(page: Page, premiumError = false) {
  await page.addInitScript(({ premiumError }) => {
    const fixture: any = { state: null, pauses: 0, disconnected: 0, listeners: new Map() };
    (window as any).spotifyFixture = fixture;
    (window as any).Spotify = { Player: class {
      constructor(_options: unknown) {}
      addListener(name: string, callback: Function) { fixture.listeners.set(name, callback); return true; }
      removeListener(name: string) { fixture.listeners.delete(name); }
      async connect() { setTimeout(() => fixture.listeners.get(premiumError ? 'account_error' : 'ready')?.(premiumError ? { message: 'Mock only' } : { device_id: 'fixture-device' }), 0); return true; }
      disconnect() { fixture.disconnected++; fixture.state = null; }
      async getCurrentState() { return fixture.state; }
      async activateElement() {}
      async getVolume() { return .65; }
      async setVolume(_volume: number) {}
      async pause() { fixture.pauses++; if (fixture.state) fixture.state.paused = true; fixture.listeners.get('player_state_changed')?.(fixture.state); }
      async resume() { if (fixture.state) fixture.state.paused = false; fixture.listeners.get('player_state_changed')?.(fixture.state); }
      async seek(position: number) { if (fixture.state) fixture.state.position = position; }
      async nextTrack() {}
      async previousTrack() {}
    } };
  }, { premiumError });
  await page.route('https://accounts.spotify.com/authorize?**', async route => {
    const url = new URL(route.request().url()); expect(url.searchParams.get('code_challenge_method')).toBe('S256'); expect(url.searchParams.get('code_challenge')).toHaveLength(43); expect(url.searchParams.has('client_secret')).toBe(false);
    await route.fulfill({ status: 302, headers: { location: `http://127.0.0.1:5173/callback?code=fixture-code&state=${url.searchParams.get('state')}` } });
  });
  await page.route('https://accounts.spotify.com/api/token', route => route.fulfill({ json: { access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope: scopes } }));
  await page.route('https://api.spotify.com/v1/**', async route => {
    const url = new URL(route.request().url()); expect(route.request().headers().authorization).toBe('Bearer fixture-token');
    if (url.pathname === '/v1/me') await route.fulfill({ json: { id: 'fixture-user', display_name: 'Usuario de prueba' } });
    else if (url.pathname === '/v1/search') { expect(url.searchParams.get('limit')).toBe('10'); await route.fulfill({ json: { tracks: { items: [track], total: 1 } } }); }
    else if (url.pathname === '/v1/me/player/play') {
      expect(route.request().postDataJSON()).toEqual({ uris: [track.uri] });
      const localPaused = await page.locator('audio').evaluateAll(elements => elements.every(element => (element as HTMLAudioElement).paused)); expect(localPaused).toBe(true);
      await page.evaluate(track => { const fixture = (window as any).spotifyFixture; fixture.state = { paused: false, position: 1200, duration: 180000, track_window: { current_track: track }, disallows: {} }; }, track);
      await route.fulfill({ status: 204 });
    } else throw new Error('Unexpected fixture endpoint: ' + url.pathname);
  });
}
test('Spotify is optional and opens without external requests or changing local audio', async ({ page }) => {
  const external: string[] = []; page.on('request', request => { if (/spotify|scdn/.test(new URL(request.url()).hostname)) external.push(request.url()); });
  await page.goto('/'); await expect(page.locator('#spotify-panel')).toBeHidden(); await page.getByRole('button', { name: 'Explorar Spotify', exact: true }).click(); await expect(page.locator('#spotify-query')).toBeDisabled();
  await page.getByRole('button', { name: 'Seleccionar archivos', exact: true }).click(); await page.locator('#audio-files').setInputFiles(localWav()); await page.getByRole('button', { name: 'Reproducir Personal', exact: true }).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
  await expect(page.locator('#active-source')).toHaveText('Mi música'); expect(external).toEqual([]); await page.screenshot({ path: 'test-results/spotify-optional.png', fullPage: true });
});
test('invalid OAuth callback is rejected, cleaned and leaves local music usable', async ({ page }) => {
  await page.goto('/callback?code=invalid&state=invalid'); await expect(page).toHaveURL(/\/$/); await expect(page.locator('#spotify-auth-status')).toContainText('no es válida'); await expect(page.locator('#spotify-query')).toBeDisabled();
  await page.getByRole('button', { name: 'Seleccionar archivos', exact: true }).click(); await page.locator('#audio-files').setInputFiles(localWav()); await page.getByRole('button', { name: 'Reproducir Personal', exact: true }).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
});
test('mocked PKCE, SDK, search, references and exclusive playback work through the UI', async ({ page }) => {
  test.skip(production, 'Full mocked OAuth uses the configured development redirect on port 5173.');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await mockSpotify(page); await page.goto('/'); await page.getByRole('button', { name: 'Explorar Spotify', exact: true }).click(); await page.locator('#spotify-connect').click();
  await expect(page.locator('#spotify-auth-status')).toHaveText('Spotify conectado'); await expect(page).toHaveURL('http://127.0.0.1:5173/'); await expect(page.locator('#spotify-playback-status')).toContainText('Dispositivo listo');
  await page.getByRole('button', { name: 'Seleccionar archivos', exact: true }).click(); await page.locator('#audio-files').setInputFiles(localWav()); await page.getByRole('button', { name: 'Reproducir Personal', exact: true }).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
  await page.locator('#spotify-query').fill('pista'); await expect(page.locator('#spotify-results .spotify-result')).toHaveCount(1); await expect(page.locator('#spotify-results')).toContainText('Pista de prueba <segura>'); await expect(page.locator('#spotify-results segura')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar referencia en esta sesión', exact: true }).click(); await expect(page.locator('#spotify-collection .spotify-result')).toHaveCount(1);
  await page.locator('#spotify-results [data-spotify-action=play]').click(); await expect(page.locator('#spotify-playback-status')).toHaveText('Reproduciendo en Spotify'); await expect(page.locator('#active-source')).toHaveText('Escuchando Spotify'); await expect(page.locator('#play')).toBeDisabled(); await expect(page.locator('#boost')).toBeDisabled();
  await page.screenshot({ path: 'test-results/spotify-mocked-playback.png', fullPage: true }); await page.locator('#spotify-toggle').click(); await expect(page.locator('#spotify-playback-status')).toHaveText('Spotify en pausa'); await page.locator('#spotify-toggle').click(); await expect(page.locator('#spotify-playback-status')).toHaveText('Reproduciendo en Spotify');
  await page.getByRole('button', { name: 'Volver a Mi música', exact: true }).click(); await expect(page.locator('#active-source')).toHaveText('Mi música'); await expect(page.locator('#boost')).toBeEnabled(); expect(await page.evaluate(() => (window as any).spotifyFixture.state.paused)).toBe(true);
  await page.locator('#spotify-disconnect').click(); await expect(page.locator('#spotify-results .spotify-result')).toHaveCount(0); await expect(page.locator('#spotify-collection .spotify-result')).toHaveCount(0); await expect(page.locator('#spotify-user')).toBeEmpty();
  expect(await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)).some(value => /fixture-token|fixture-refresh/.test(String(value))))).toBe(false);
  await page.getByRole('button', { name: 'Reproducir Personal', exact: true }).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo'); expect(errors).toEqual([]);
});
test('mocked SDK Premium restriction does not block personal audio', async ({ page }) => {
  test.skip(production, 'Full mocked OAuth uses the configured development redirect on port 5173.');
  await mockSpotify(page, true); await page.goto('/'); await page.getByRole('button', { name: 'Explorar Spotify', exact: true }).click(); await page.locator('#spotify-connect').click(); await expect(page.locator('#spotify-auth-status')).toHaveText('Spotify conectado'); await expect(page.locator('#spotify-playback-status')).toHaveText('Se requiere Spotify Premium'); await expect(page.locator('#spotify-toggle')).toBeDisabled();
  await page.getByRole('button', { name: 'Seleccionar archivos', exact: true }).click(); await page.locator('#audio-files').setInputFiles(localWav()); await page.getByRole('button', { name: 'Reproducir Personal', exact: true }).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
});
