import type { MusicPlaybackProvider } from './MusicProvider';
import type { AudioPlayerService } from '../services/AudioPlayerService';
import type { SleepTimerService } from '../services/SleepTimerService';
import type { SpotifyPlaybackAdapter } from '../spotify/SpotifyPlaybackAdapter';
export class PlaybackCoordinator extends EventTarget {
  source: 'local' | 'spotify' = 'local';
  private revision = 0;
  private enforcing = false;
  private readonly spotifyChanged = () => {
    if (this.spotify.state === 'playing' && this.source !== 'spotify' && !this.enforcing) {
      // A remote Spotify Connect action may start the SDK outside our own buttons.
      this.localOutput.pause(); this.enforcing = true; void this.spotify.pause().catch(() => this.spotify.disconnect()).finally(() => { this.enforcing = false; });
    }
    if (!this.spotify.available && this.source === 'spotify' && this.spotify.state !== 'connecting') { this.source = 'local'; this.notify(); }
  };
  constructor(private readonly local: AudioPlayerService, private readonly spotify: SpotifyPlaybackAdapter, private readonly timer: SleepTimerService, private readonly localOutput: MusicPlaybackProvider) {
    super(); local.beforePlayback = () => this.source === 'spotify' ? this.useLocal() : undefined;
    spotify.beforePlayback = () => this.useSpotify(); spotify.addEventListener('change', this.spotifyChanged);
  }
  useSpotify(): void { this.revision++; this.localOutput.pause(); this.timer.cancel(); this.source = 'spotify'; this.notify(); }
  async useLocal(): Promise<void> {
    const revision = ++this.revision;
    try { await this.spotify.pause(); } catch { this.spotify.disconnect(); }
    if (revision !== this.revision) throw new Error('Playback transition cancelled'); this.source = 'local'; this.notify();
  }
  private notify(): void { this.dispatchEvent(new Event('change')); }
  dispose(): void { this.local.beforePlayback = null; this.spotify.beforePlayback = null; this.spotify.removeEventListener('change', this.spotifyChanged); }
}
