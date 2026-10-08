import type { MusicPlaybackProvider, MusicReference } from '../music/MusicProvider';
import type { SpotifyAuthService } from './SpotifyAuthService';
import type { SpotifyApiClient } from './SpotifyApiClient';
import { normalizeSpotifyTrack } from './SpotifyCatalogAdapter';
import { SpotifyError } from './SpotifyError';
import { loadSpotifySdk, type SdkPlayer, type SdkState, type SpotifySdk } from './SpotifySdk';
export type SpotifyPlaybackState = 'unavailable' | 'connecting' | 'ready' | 'playing' | 'paused' | 'error' | 'premium-required';
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new SpotifyError('timeout', 'El reproductor Spotify tardó demasiado en responder.')), 12000); })]); }
  finally { if (timer) clearTimeout(timer); }
}
export class SpotifyPlaybackAdapter extends EventTarget implements MusicPlaybackProvider {
  readonly providerId = 'spotify';
  state: SpotifyPlaybackState = 'unavailable';
  status = 'El reproductor Spotify requiere autorización y Premium.';
  track: MusicReference | null = null;
  deviceId: string | null = null;
  snapshot: SdkState | null = null;
  volume = .65;
  volumeAvailable = false;
  private sdk: SdkPlayer | null = null;
  private listeners = new Map<string, (event: unknown) => void>();
  private initialization: Promise<void> | null = null;
  private revision = 0;
  private actionRevision = 0;
  private pendingSdkActions = 0;
  private startController: AbortController | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private positionTime = 0;
  private settleReady: ((error?: SpotifyError) => void) | null = null;
  beforePlayback: (() => void | Promise<void>) | null = null;
  private readonly authChanged = () => { if (!this.auth.connected) this.disconnect(); };
  constructor(private readonly auth: SpotifyAuthService, private readonly api: SpotifyApiClient, private readonly loadSdk: () => Promise<SpotifySdk> = loadSpotifySdk) { super(); auth.addEventListener('change', this.authChanged); }
  get position(): number { if (!this.snapshot) return 0; return Math.min(this.snapshot.duration, this.snapshot.position + (this.snapshot.paused ? 0 : Math.max(0, Date.now() - this.positionTime))) / 1000; }
  get duration(): number { return (this.snapshot?.duration ?? 0) / 1000; }
  get available(): boolean { return this.auth.connected && !!this.deviceId && !!this.sdk && !['error', 'premium-required', 'unavailable', 'connecting'].includes(this.state); }
  get canPause(): boolean { return this.available && !!this.snapshot && !this.snapshot.disallows?.pausing; }
  get canResume(): boolean { return this.available && !!this.snapshot && !this.snapshot.disallows?.resuming; }
  get canSeek(): boolean { return this.available && !!this.snapshot && !this.snapshot.disallows?.seeking; }
  get canNext(): boolean { return this.available && !!this.snapshot && !this.snapshot.disallows?.skipping_next; }
  get canPrevious(): boolean { return this.available && !!this.snapshot && !this.snapshot.disallows?.skipping_prev; }
  private notify(): void { this.dispatchEvent(new Event('change')); }
  initialize(): Promise<void> {
    if (this.available) return Promise.resolve(); if (this.initialization) return this.initialization;
    const pending = this.connectSdk(); this.initialization = pending;
    void pending.finally(() => { if (this.initialization === pending) this.initialization = null; }).catch(() => {}); return pending;
  }
  private async connectSdk(): Promise<void> {
    if (!this.auth.connected) throw new SpotifyError('authentication', 'Conecta Spotify antes de activar su reproductor.');
    this.disconnect(false); const revision = this.revision; this.state = 'connecting'; this.status = 'Preparando el reproductor oficial de Spotify…'; this.notify();
    try {
      const sdk = await this.loadSdk(); if (revision !== this.revision || !this.auth.connected) throw new SpotifyError('cancelled', 'Conexión del reproductor cancelada.');
      this.sdk = new sdk.Player({ name: 'Sonaris — Spotify', volume: this.volume, getOAuthToken: callback => { void this.auth.getAccessToken().then(token => { if (revision === this.revision) callback(token); }).catch(() => this.fail('authentication')); } });
      const ready = new Promise<void>((resolve, reject) => { this.settleReady = error => { this.settleReady = null; if (error) reject(error); else resolve(); }; });
      this.listen('ready', event => { const id = (event as { device_id?: unknown })?.device_id; if (typeof id === 'string' && id.length > 0 && id.length <= 200) { this.deviceId = id; this.settleReady?.(); } });
      this.listen('not_ready', () => { this.releaseSdk(); this.state = 'unavailable'; this.status = 'Dispositivo Spotify desconectado. Puedes volver a activarlo.'; this.notify(); });
      this.listen('player_state_changed', state => this.acceptState(state as SdkState | null));
      this.listen('autoplay_failed', () => { this.status = 'El navegador bloqueó el inicio automático. Pulsa Reanudar Spotify o usa el dispositivo desde Spotify.'; this.notify(); });
      for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) this.listen(event, () => this.fail(event === 'account_error' ? 'premium' : event === 'authentication_error' ? 'authentication' : 'device'));
      const connected = this.sdk.connect().then(value => { if (!value) throw new SpotifyError('device', 'No fue posible registrar el dispositivo Spotify.'); });
      try { await bounded(Promise.all([connected, ready])); } finally { this.settleReady?.(new SpotifyError('cancelled', 'Registro del dispositivo finalizado.')); }
      if (revision !== this.revision) throw new SpotifyError('cancelled', 'Conexión cancelada.');
      this.state = 'ready'; this.status = 'Dispositivo listo. Selecciona una canción para comprobar reproducción.';
      try { this.volume = await bounded(this.sdk.getVolume()); this.volumeAvailable = true; } catch { this.volumeAvailable = false; }
      if (revision !== this.revision || !this.sdk) throw new SpotifyError('cancelled', 'Conexión cancelada.');
      this.poll = setInterval(() => { if (!this.polling && this.sdk && this.deviceId) { this.polling = true; const pollingSdk = this.sdk; void bounded(pollingSdk.getCurrentState()).then(state => { if (this.sdk === pollingSdk && revision === this.revision) this.acceptState(state); }).catch(() => { if (this.sdk === pollingSdk && revision === this.revision) { this.status = 'No se pudo consultar el estado del dispositivo.'; this.notify(); } }).finally(() => { if (this.sdk === pollingSdk) this.polling = false; }); } }, 1000);
      this.notify();
    } catch (error) { if (revision === this.revision && !['premium-required', 'error'].includes(this.state)) this.fail(error instanceof SpotifyError ? error.code === 'authentication' ? 'authentication' : 'device' : 'unsupported'); if (revision === this.revision) this.releaseSdk(); throw error; }
  }
  private listen(name: string, callback: (event: unknown) => void): void { this.listeners.set(name, callback); this.sdk!.addListener(name, callback); }
  private acceptState(state: SdkState | null): void {
    if (!this.sdk || !this.auth.connected) return;
    if (!state) { this.snapshot = null; this.track = null; if (this.deviceId) this.state = 'ready'; this.notify(); return; }
    if (!Number.isFinite(state.position) || !Number.isFinite(state.duration) || state.position < 0 || state.duration < 0 || !state.track_window?.current_track) return;
    this.snapshot = state; this.positionTime = Date.now(); this.track = normalizeSpotifyTrack(state.track_window.current_track); this.state = state.paused ? 'paused' : 'playing'; this.status = state.paused ? 'Spotify en pausa' : 'Reproduciendo en Spotify'; this.notify();
  }
  private fail(code: 'premium' | 'authentication' | 'device' | 'unsupported'): void {
    this.cancelPending(); this.state = code === 'premium' ? 'premium-required' : 'error'; this.status = code === 'premium' ? 'Se requiere Spotify Premium' : code === 'authentication' ? 'Spotify rechazó la sesión. Reconecta tu cuenta.' : code === 'unsupported' ? 'Este navegador no pudo iniciar el reproductor protegido de Spotify.' : 'No fue posible reproducir en Spotify. Revisa dispositivo, permisos y conexión.';
    this.settleReady?.(new SpotifyError(code, this.status)); this.releaseSdk(); this.notify(); if (code === 'authentication') this.auth.expire();
  }
  private cancelPending(): void { this.actionRevision++; this.startController?.abort(); this.startController = null; }
  activate(): void { if (this.sdk) void this.sdk.activateElement().catch(() => { this.status = 'Pulsa de nuevo para autorizar reproducción en este navegador.'; this.notify(); }); }
  async playTrack(track: MusicReference): Promise<void> {
    if (track.providerId !== 'spotify' || track.playbackCapability !== 'spotify-premium' || !/^spotify:track:[A-Za-z\d]{22}$/.test(track.spotifyUri ?? '')) throw new SpotifyError('forbidden', 'La canción no admite reproducción Spotify autorizada.');
    if (!this.available) throw new SpotifyError('device', 'Activa el reproductor Spotify antes de reproducir.');
    this.activate(); this.cancelPending(); const revision = this.actionRevision; const controller = new AbortController(); this.startController = controller;
    try {
      await this.beforePlayback?.(); if (revision !== this.actionRevision) throw new SpotifyError('cancelled', 'Reproducción cancelada.');
      await this.api.call(`/me/player/play?device_id=${encodeURIComponent(this.deviceId!)}`, 'PUT', { uris: [track.spotifyUri] }, controller.signal);
      if (revision !== this.actionRevision) throw new SpotifyError('cancelled', 'Reproducción cancelada.');
      // API acceptance is not evidence of audio: only SDK state can report playing.
      this.status = 'Solicitud enviada. Esperando confirmación del reproductor Spotify…'; this.notify();
      await this.syncState();
    } finally { if (this.startController === controller) this.startController = null; }
  }
  private async sdkPlaybackAction(action: 'resume' | 'nextTrack' | 'previousTrack'): Promise<void> {
    const sdk = this.sdk; const revision = this.actionRevision;
    if (!sdk) throw new SpotifyError('device', 'Activa el reproductor Spotify.');
    this.activate(); this.pendingSdkActions++;
    try {
      await this.beforePlayback?.();
      if (revision !== this.actionRevision || this.sdk !== sdk) throw new SpotifyError('cancelled', 'Reproducción cancelada.');
      await bounded(sdk[action]());
      if (revision !== this.actionRevision || this.sdk !== sdk) throw new SpotifyError('cancelled', 'Reproducción cancelada.');
      await this.syncState();
    } finally { this.pendingSdkActions--; }
  }
  async resume(): Promise<void> { if (!this.canResume) throw new SpotifyError('forbidden', 'Spotify no permite reanudar en este estado.'); await this.sdkPlaybackAction('resume'); }
  async pause(): Promise<void> {
    const pendingStart = !!this.startController || this.pendingSdkActions > 0; this.cancelPending(); if (!this.sdk) return; if (pendingStart) { this.disconnect(); return; }
    try { await bounded(this.sdk.pause()); const state = await bounded(this.sdk.getCurrentState()); if (state && !state.paused) throw new SpotifyError('device', 'No se confirmó la pausa del dispositivo.'); this.acceptState(state); }
    catch (error) { this.disconnect(); throw error; }
  }
  async seek(seconds: number): Promise<void> { if (!this.canSeek || !Number.isFinite(seconds)) throw new SpotifyError('forbidden', 'Spotify no permite cambiar el progreso ahora.'); await bounded(this.sdk!.seek(Math.round(Math.max(0, Math.min(this.duration, seconds)) * 1000))); await this.syncState(); }
  async next(): Promise<void> { if (!this.canNext) throw new SpotifyError('forbidden', 'Spotify no permite avanzar ahora.'); await this.sdkPlaybackAction('nextTrack'); }
  async previous(): Promise<void> { if (!this.canPrevious) throw new SpotifyError('forbidden', 'Spotify no permite retroceder ahora.'); await this.sdkPlaybackAction('previousTrack'); }
  async setVolume(value: number): Promise<void> { if (!this.available || !this.volumeAvailable || !Number.isFinite(value)) throw new SpotifyError('unsupported', 'El control de volumen Spotify no está disponible.'); try { await bounded(this.sdk!.setVolume(Math.max(0, Math.min(1, value)))); this.volume = Math.max(0, Math.min(1, value)); this.notify(); } catch (error) { this.volumeAvailable = false; this.notify(); throw error; } }
  private async syncState(): Promise<void> { const sdk = this.sdk; if (sdk) { const state = await bounded(sdk.getCurrentState()); if (this.sdk === sdk) this.acceptState(state); } }
  private releaseSdk(): void {
    if (this.poll) clearInterval(this.poll); this.poll = null; this.polling = false;
    if (this.sdk) { for (const [name, callback] of this.listeners) this.sdk.removeListener(name, callback); this.sdk.disconnect(); }
    this.listeners.clear(); this.sdk = null; this.deviceId = null; this.volumeAvailable = false; this.snapshot = null; this.track = null;
  }
  disconnect(notify = true): void { this.revision++; this.initialization = null; this.cancelPending(); this.settleReady?.(new SpotifyError('cancelled', 'Dispositivo desconectado.')); this.releaseSdk(); this.state = 'unavailable'; this.status = 'Reproductor Spotify desconectado.'; if (notify) this.notify(); }
  dispose(): void { this.auth.removeEventListener('change', this.authChanged); this.disconnect(); }
}
