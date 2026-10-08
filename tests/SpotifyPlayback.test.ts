import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { SpotifyAuthService, spotifyScopes } from '../src/spotify/SpotifyAuthService';
import { SpotifyPlaybackAdapter } from '../src/spotify/SpotifyPlaybackAdapter';
import { normalizeSpotifyTrack } from '../src/spotify/SpotifyCatalogAdapter';
import type { SpotifyApiClient } from '../src/spotify/SpotifyApiClient';
import type { SdkPlayer, SdkPlayerOptions, SdkState, SpotifySdk } from '../src/spotify/SpotifySdk';
import { PlaybackCoordinator } from '../src/music/PlaybackCoordinator';
import { LocalMusicProvider } from '../src/music/LocalMusicProvider';
import { PlaylistService } from '../src/services/PlaylistService';
import { AudioPlayerService } from '../src/services/AudioPlayerService';
import { SleepTimerService } from '../src/services/SleepTimerService';
import { FakeOutput, song } from './helpers';
const id = 'A'.repeat(22), secondId = 'B'.repeat(22), record = (trackId = id) => ({ id: trackId, name: 'Fixture track', uri: `spotify:track:${trackId}`, duration_ms: 180000, artists: [{ name: 'Fixture artist' }], album: { name: 'Fixture album', images: [] } });
class MockSdkPlayer implements SdkPlayer {
  callbacks = new Map<string, (event: unknown) => void>(); state: SdkState | null = null; options: SdkPlayerOptions;
  constructor(options: SdkPlayerOptions) { this.options = options; }
  connect = vi.fn(async () => { this.emit('ready', { device_id: 'fixture-device' }); return true; });
  disconnect = vi.fn(); addListener = vi.fn((name: string, callback: (event: unknown) => void) => { this.callbacks.set(name, callback); return true; }); removeListener = vi.fn((name: string) => this.callbacks.delete(name));
  getCurrentState = vi.fn(async () => this.state); activateElement = vi.fn(async () => {});
  pause = vi.fn(async () => { if (this.state) this.state = { ...this.state, paused: true }; }); resume = vi.fn(async () => { if (this.state) this.state = { ...this.state, paused: false }; });
  seek = vi.fn(async (position: number) => { if (this.state) this.state = { ...this.state, position }; }); nextTrack = vi.fn(async () => {}); previousTrack = vi.fn(async () => {});
  setVolume = vi.fn(async (_volume: number) => {}); getVolume = vi.fn(async () => .65);
  emit(name: string, event: unknown): void { this.callbacks.get(name)?.(event); }
  playing(paused = false): void { this.state = { paused, position: 1000, duration: 180000, track_window: { current_track: record() }, disallows: {} }; this.emit('player_state_changed', this.state); }
}
const cleanup: (() => void)[] = [];
beforeEach(() => sessionStorage.clear()); afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); vi.useRealTimers(); });
async function setup() {
  const config = { clientId: 'ce80cd6caaad49fb87bf511aaf07e369', redirectUri: 'http://127.0.0.1:5173/callback' }, auth = new SpotifyAuthService(config, { origin: 'http://127.0.0.1:5173', crypto: webcrypto as unknown as Crypto, navigate: () => {}, replaceUrl: () => {}, request: async url => String(url).includes('/api/token') ? Response.json({ access_token: 'mock', refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'Bearer', scope: spotifyScopes.join(' ') }) : Response.json({ id: 'fixture-user' }) });
  await auth.connect(); const transaction = JSON.parse(sessionStorage.getItem('sonaris.spotify.pkce')!); await auth.handleCallback(new URL(config.redirectUri + '?code=mock&state=' + transaction.state));
  let sdk!: MockSdkPlayer; const library = new PlaylistService({ load: () => [], save: () => true }), output = new FakeOutput(), local = new AudioPlayerService(output, { initialVolume: .65, fadeDuration: 1000, boostFactor: 1.35 }); library.active.songs.addLast(song('Local')); local.attach(library.active); const timer = new SleepTimerService(local);
  const call = vi.fn(async (): Promise<unknown> => undefined), loader = vi.fn(async () => ({ Player: class extends MockSdkPlayer { constructor(options: SdkPlayerOptions) { super(options); sdk = this; } } } as SpotifySdk)), playback = new SpotifyPlaybackAdapter(auth, { call } as unknown as SpotifyApiClient, loader), coordinator = new PlaybackCoordinator(local, playback, timer, new LocalMusicProvider(library, local));
  cleanup.push(() => { coordinator.dispose(); playback.dispose(); auth.dispose(); timer.dispose(); local.dispose(); library.dispose(); }); return { auth, playback, loader, sdk: () => sdk, call, local, output, timer, coordinator, library };
}
describe('Spotify SDK adapter and exclusive coordination with mocks', () => {
  it('initializes one device after authorization and releases listeners, polling and SDK', async () => { const { auth, playback, sdk, loader } = await setup(); await Promise.all([playback.initialize(), playback.initialize()]); expect(loader).toHaveBeenCalledOnce(); expect(playback.state).toBe('ready'); expect(playback.deviceId).toBe('fixture-device'); expect(playback.track).toBeNull(); auth.disconnect(); expect(sdk().disconnect).toHaveBeenCalled(); expect(playback.available).toBe(false); expect(sdk().callbacks.size).toBe(0); });
  it('keeps Premium failure distinct from a successful login', async () => { const { playback, sdk } = await setup(); await playback.initialize(); sdk().emit('account_error', { message: 'sensitive raw error' }); expect(playback.state).toBe('premium-required'); expect(playback.status).toBe('Se requiere Spotify Premium'); expect(playback.status).not.toContain('sensitive'); expect(playback.available).toBe(false); expect(sdk().disconnect).toHaveBeenCalled(); });
  it('does not report playing just because the API accepted a request', async () => { const { playback, call, sdk, coordinator } = await setup(); await playback.initialize(); await playback.playTrack(normalizeSpotifyTrack(record())!); expect(call).toHaveBeenCalledWith('/me/player/play?device_id=fixture-device', 'PUT', { uris: [`spotify:track:${id}`] }, expect.any(AbortSignal)); expect(playback.state).toBe('ready'); expect(coordinator.source).toBe('spotify'); sdk().playing(); expect(playback.state).toBe('playing'); expect(playback.track?.providerId).toBe('spotify'); });
  it('pauses local audio before Spotify and confirms SDK pause before local playback', async () => { const { playback, sdk, local, output, timer, coordinator } = await setup(); await playback.initialize(); await local.play(); timer.start(15); await playback.playTrack(normalizeSpotifyTrack(record())!); expect(local.state).toBe('paused'); expect(timer.active).toBe(false); expect(coordinator.source).toBe('spotify'); sdk().playing(); await local.play(); expect(sdk().pause).toHaveBeenCalled(); expect(sdk().state?.paused).toBe(true); expect(output.play).toHaveBeenCalledTimes(2); expect(local.state).toBe('playing'); expect(coordinator.source).toBe('local'); });
  it('fails closed by disconnecting the SDK if pause cannot be confirmed', async () => { const { playback, sdk, local, coordinator } = await setup(); await playback.initialize(); await playback.playTrack(normalizeSpotifyTrack(record())!); sdk().playing(); sdk().pause.mockRejectedValue(new Error('network')); await local.play(); expect(sdk().disconnect).toHaveBeenCalled(); expect(coordinator.source).toBe('local'); expect(local.state).toBe('playing'); });
  it('cancels an in-flight Spotify start when returning to local without late playback', async () => { const { playback, call, sdk, coordinator } = await setup(); await playback.initialize(); let resolve!: () => void; call.mockImplementation(() => new Promise<void>(done => { resolve = done; })); const start = playback.playTrack(normalizeSpotifyTrack(record())!); const rejected = expect(start).rejects.toMatchObject({ code: 'cancelled' }); await Promise.resolve(); await Promise.resolve(); await coordinator.useLocal(); resolve(); await rejected; expect(sdk().disconnect).toHaveBeenCalled(); expect(playback.state).toBe('unavailable'); expect(coordinator.source).toBe('local'); });
  it('disconnects an in-flight SDK resume before allowing local playback', async () => {
    const { playback, sdk, local, coordinator } = await setup(); await playback.initialize(); coordinator.useSpotify(); sdk().playing(true);
    let resolve!: () => void; sdk().resume.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const resume = playback.resume(); const rejected = expect(resume).rejects.toMatchObject({ code: 'cancelled' });
    await Promise.resolve(); await local.play(); expect(sdk().disconnect).toHaveBeenCalled(); expect(local.state).toBe('playing');
    resolve(); await rejected; expect(coordinator.source).toBe('local'); expect(playback.state).toBe('unavailable');
  });
  it('honors SDK restrictions, seek/volume capabilities and does not process remote audio', async () => { const { playback, sdk, coordinator } = await setup(); await playback.initialize(); coordinator.useSpotify(); sdk().playing(); await playback.seek(10); expect(sdk().seek).toHaveBeenCalledWith(10000); await playback.setVolume(.4); expect(sdk().setVolume).toHaveBeenCalledWith(.4); sdk().state!.disallows = { seeking: true, skipping_next: true }; sdk().emit('player_state_changed', sdk().state); expect(playback.canSeek).toBe(false); await expect(playback.seek(5)).rejects.toThrow(); await expect(playback.next()).rejects.toThrow(); sdk().setVolume.mockRejectedValue(new Error('unavailable')); await expect(playback.setVolume(.3)).rejects.toThrow(); expect(playback.volumeAvailable).toBe(false); });
  it('enforces unexpected Spotify Connect playback while local mode is selected', async () => { const { playback, sdk, local, coordinator } = await setup(); await playback.initialize(); await local.play(); sdk().playing(); await Promise.resolve(); await Promise.resolve(); expect(local.state).toBe('paused'); expect(sdk().pause).toHaveBeenCalled(); expect(coordinator.source).toBe('local'); });
  it('leaves the local playlist, queue and pointers intact after SDK errors', async () => { const { playback, sdk, local, library } = await setup(); const snapshot = library.active.songs.readSnapshot(); local.queue.add(library.active.songs.head!.song, library.active.id, library.active.name); await playback.initialize(); sdk().emit('initialization_error', {}); expect(library.active.songs.readSnapshot()).toEqual(snapshot); expect(local.queue.entries.getSize()).toBe(1); library.active.songs.assertIntegrity(); });
});
