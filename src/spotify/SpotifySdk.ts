export interface SdkTrack { id: string; name: string; uri: string; duration_ms?: number; artists: { name: string }[]; album: { name: string; images: { url: string }[] }; }
export interface SdkState { paused: boolean; position: number; duration: number; track_window: { current_track: SdkTrack }; disallows?: { pausing?: boolean; resuming?: boolean; seeking?: boolean; skipping_next?: boolean; skipping_prev?: boolean; }; }
export interface SdkPlayer {
  connect(): Promise<boolean>; disconnect(): void;
  addListener(name: string, callback: (event: unknown) => void): boolean;
  removeListener(name: string, callback?: (event: unknown) => void): boolean;
  getCurrentState(): Promise<SdkState | null>; activateElement(): Promise<void>;
  pause(): Promise<void>; resume(): Promise<void>; seek(milliseconds: number): Promise<void>;
  nextTrack(): Promise<void>; previousTrack(): Promise<void>; setVolume(value: number): Promise<void>; getVolume(): Promise<number>;
}
export interface SdkPlayerOptions { name: string; getOAuthToken: (callback: (token: string) => void) => void; volume: number; }
export interface SpotifySdk { Player: new (options: SdkPlayerOptions) => SdkPlayer; }
declare global { interface Window { Spotify?: SpotifySdk; onSpotifyWebPlaybackSDKReady?: () => void; } }
let loading: Promise<SpotifySdk> | null = null;
export function loadSpotifySdk(): Promise<SpotifySdk> {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (loading) return loading;
  loading = new Promise<SpotifySdk>((resolve, reject) => {
    const script = document.createElement('script'), previous = window.onSpotifyWebPlaybackSDKReady;
    script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true; script.referrerPolicy = 'no-referrer';
    const cleanup = () => { clearTimeout(timer); script.onerror = null; if (window.onSpotifyWebPlaybackSDKReady === ready) window.onSpotifyWebPlaybackSDKReady = previous; };
    const fail = () => { cleanup(); script.remove(); reject(new Error('Spotify SDK unavailable')); };
    const ready = () => { cleanup(); previous?.(); if (window.Spotify) resolve(window.Spotify); else fail(); };
    const timer = setTimeout(fail, 15000); window.onSpotifyWebPlaybackSDKReady = ready; script.onerror = fail; document.head.append(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}
