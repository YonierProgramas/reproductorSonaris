import type { Playlist, RepeatMode } from '../models/Playlist';
import type { Song } from '../models/Song';
import type { AudioOutput } from '../patterns/bridge/AudioOutput';
import { NormalPlayback, RepeatAllPlayback, RepeatOnePlayback, ShufflePlayback, type PlaybackMode } from '../patterns/bridge/PlaybackMode';
import { BasicTrackPlayback, FadeInDecorator, VolumeBoostDecorator, type TrackPlayback } from '../patterns/decorator/TrackPlayback';
import { PlaybackQueue, type PlaybackEntry } from './PlaybackQueue';
import type { PlayerConfiguration } from '../patterns/factory/PlayerEnvironmentFactory';
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export class AudioPlayerService extends EventTarget {
  beforePlayback: (() => void | Promise<void>) | null = null;
  readonly queue = new PlaybackQueue();
  private history: PlaybackEntry[] = [];
  private readonly forward = new PlaybackQueue();
  shuffleFinished = false;
  private queuedSong: PlaybackEntry | null = null;
  private started = false;
  private replayingHistory = false;
  private sessionId = crypto.randomUUID();
  private lastWall = 0;
  private lastTime = 0;
  private origin: {songId: string; playlistId: string; playlistName: string} | null = null;
  private attenuation = 1;
  playlist: Playlist | null = null;
  state: PlaybackState = 'idle';
  volume: number;
  fadeEnabled = false;
  boostEnabled = false;
  private playback: TrackPlayback;
  private mode: PlaybackMode;
  private loadedSong: Song | null = null;
  private revision = 0;
  constructor(readonly output: AudioOutput, private readonly configuration: PlayerConfiguration) {
    super(); this.queue.addEventListener('change',()=>this.notify()); this.volume = configuration.initialVolume; this.playback = new BasicTrackPlayback(output); this.mode = new NormalPlayback(output); this.playback.setVolume(this.volume);
    output.element.addEventListener('timeupdate', () => { this.listen(); this.notify(); });
    output.element.addEventListener('loadedmetadata', () => { if (this.loadedSong) this.loadedSong.duration = Number.isFinite(output.element.duration) ? output.element.duration : 0; this.notify(); });
    output.element.addEventListener('play', () => { this.state = 'playing'; this.notify(); });
    output.element.addEventListener('pause', () => { if (this.state !== 'error') this.state = this.loadedSong ? 'paused' : 'idle'; this.notify(); });
    output.element.addEventListener('error', () => { if (this.loadedSong) this.fail(); });
    output.element.addEventListener('ended', () => { void this.ended(); });
  }
  get song(): Song | null { return this.queuedSong?.song ?? this.playlist?.songs.current?.song ?? null; }
  get canNext(): boolean { return !this.queue.entries.isEmpty() || (this.mode instanceof ShufflePlayback ? !this.forward.entries.isEmpty() || !!this.playlist && this.mode.hasNext(this.playlist) : !!this.playlist?.songs.current?.next); }
  get canPrevious(): boolean { return this.history.some(entry=>entry.songId!==this.origin?.songId || entry.playlistId!==this.origin?.playlistId) || (!(this.mode instanceof ShufflePlayback) && !!this.playlist?.songs.current?.previous); }
  get isQueued(): boolean { return !!this.queuedSong; }
  get currentTime(): number { return this.output.element.currentTime || 0; }
  get duration(): number { return this.song?.duration ?? 0; }
  private notify(): void { this.dispatchEvent(new Event('change')); }
  private fail(): void { this.playback.pause(); this.state = 'error'; this.notify(); this.dispatchEvent(new Event('playbackerror')); }
  attach(playlist: Playlist): void { this.stop(); this.clearHistory(); this.playlist = playlist; this.mode = new NormalPlayback(this.output); this.setMode(playlist.repeatMode); this.load(); }
  private clearHistory(): void { this.forward.clear(); for (const entry of this.history) entry.song.dispose(); this.history = []; }
  private remember(): void {
    if ((!this.started && !this.replayingHistory) || !this.loadedSong || !this.origin) return;
    this.history.push({id: crypto.randomUUID(), song: this.loadedSong.clone(), ...this.origin});
    if (!(this.mode instanceof ShufflePlayback)) while (this.history.length > 50) this.history.shift()!.song.dispose();
  }
  private load(entry: PlaybackEntry | null = null, remember = true): void {
    if (remember) this.remember();
    if (entry) this.shuffleFinished = false;
    this.revision++; this.playback.pause(); this.output.load(null);
    if (this.queuedSong && this.queuedSong !== entry) this.queuedSong.song.dispose();
    this.queuedSong = entry; this.loadedSong = this.song;
    this.origin = entry ? {songId:entry.songId,playlistId:entry.playlistId,playlistName:entry.playlistName} : this.playlist && this.loadedSong ? {songId:this.loadedSong.id,playlistId:this.playlist.id,playlistName:this.playlist.name} : null;
    this.sessionId = crypto.randomUUID(); this.started = false; this.replayingHistory = false; this.lastWall = 0; this.lastTime = 0;
    this.output.load(this.loadedSong?.source ?? null); this.state = this.loadedSong ? 'paused' : 'idle'; this.notify();
  }
  private listen(): void {
    const now = Date.now(); const time = this.currentTime;
    if (this.state === 'playing' && this.started && this.origin && this.loadedSong && this.lastWall) {
      const seconds = Math.max(0, Math.min((now-this.lastWall)/1000, time-this.lastTime, 5));
      if (seconds > 0) this.dispatchEvent(new CustomEvent('listening', {detail:{seconds, sessionId:this.sessionId, title:this.loadedSong.title, ...this.origin}}));
    }
    this.lastWall = now; this.lastTime = time;
  }
  forget(playlistId: string, songId?: string): void {
    this.queue.forget(playlistId,songId); this.forward.forget(playlistId,songId);
    this.history = this.history.filter(entry=>{ if (entry.playlistId !== playlistId || (songId && entry.songId !== songId)) return true; entry.song.dispose(); return false; });
    if (this.origin?.playlistId === playlistId && (!songId || this.origin.songId === songId)) this.stop();
  }
  sync(): void { if (this.queuedSong) { this.notify(); return; } if (this.loadedSong !== this.song) this.load(); else this.notify(); }
  select(id: string): void { if (this.playlist?.songs.setCurrent(id)) { this.forward.clear(); this.shuffleFinished = false; if (this.mode instanceof ShufflePlayback) this.mode.reset(this.playlist); this.load(); } }
  async play(): Promise<boolean> {
    if (!this.song) return false;
    if (this.mode instanceof ShufflePlayback && this.playlist) { if (this.shuffleFinished) this.mode.reset(this.playlist); this.shuffleFinished = false; if (!this.queuedSong || this.queuedSong.playlistId === this.playlist.id) this.mode.observe(this.queuedSong?.songId ?? this.song.id); }
    if (this.loadedSong !== this.song) this.load();
    const revision = this.revision;
    this.state = 'loading'; this.notify();
    try { const transition = this.beforePlayback?.(); if (transition) await transition; if (revision !== this.revision) return false; await this.playback.play(); if (revision !== this.revision) return false; this.state = 'playing'; this.lastWall = Date.now(); this.lastTime = this.currentTime; if (!this.started) { this.started = true; this.dispatchEvent(new CustomEvent('trackstart', {detail:{sessionId:this.sessionId,title:this.song!.title,...this.origin}})); } this.notify(); return true; }
    catch { if (revision === this.revision) this.fail(); return false; }
  }
  pause(): void { this.listen(); this.revision++; this.playback.pause(); this.state = this.song ? 'paused' : 'idle'; this.notify(); }
  stop(): void { this.pause(); this.output.load(null); this.queuedSong?.song.dispose(); this.queuedSong = null; this.loadedSong = null; this.started = false; this.state = 'idle'; this.notify(); }
  async next(): Promise<boolean> { return this.navigate('next'); }
  async previous(): Promise<boolean> { return this.navigate('previous'); }
  private async navigate(direction: 'next' | 'previous'): Promise<boolean> {
    const resume = this.state === 'playing';
    if (direction === 'next') {
      const entry = this.queue.take();
      if (entry) { this.forward.clear(); this.load(entry); if (resume) await this.play(); return true; }
      if (this.mode instanceof ShufflePlayback) { const forward = this.forward.take(); if (forward) { this.restoreEntry(forward); if (resume) await this.play(); return true; } }
    } else {
      while (this.history.length && this.history.at(-1)!.songId===this.origin?.songId && this.history.at(-1)!.playlistId===this.origin?.playlistId) this.history.pop()!.song.dispose();
      if (this.history.length) {
      if (this.mode instanceof ShufflePlayback && this.loadedSong && this.origin && (this.started || this.replayingHistory || this.shuffleFinished)) { this.forward.add(this.loadedSong, this.origin.playlistId, this.origin.playlistName, true); this.forward.entries.head!.song.songId = this.origin.songId; }
      this.shuffleFinished = false; const entry = this.history.pop()!;
      if (entry.playlistId === this.playlist?.id && this.playlist.songs.setCurrent(entry.songId)) { entry.song.dispose(); this.load(null,false); }
      else this.load(entry,false);
      this.replayingHistory = true;
      if (resume) await this.play(); return true;
      }
    }
    const song = this.mode instanceof ShufflePlayback ? direction === 'next' && this.playlist ? this.mode.next(this.playlist) : null : direction === 'next' ? this.playlist?.songs.moveNext() : this.playlist?.songs.movePrevious();
    if (!song) return false; this.shuffleFinished = false; this.load(); if (resume) await this.play(); return true;
  }
  private restoreEntry(entry: PlaybackEntry): void {
    this.shuffleFinished = false;
    if (entry.playlistId === this.playlist?.id && this.playlist.songs.setCurrent(entry.songId)) { entry.song.dispose(); this.load(); }
    else this.load(entry);
    this.replayingHistory = true;
  }
  private async ended(): Promise<void> {
    if (!this.playlist) return;
    const entry = this.queue.take();
    if (entry) { this.forward.clear(); this.load(entry); await this.play(); return; }
    if (this.mode instanceof ShufflePlayback) {
      const forward = this.forward.take();
      if (forward) { this.restoreEntry(forward); await this.play(); return; }
    }
    this.remember(); this.revision++; this.playback.pause(); this.output.load(null);
    this.queuedSong?.song.dispose(); this.queuedSong = null;
    const song = this.mode.onEnded(this.playlist);
    this.loadedSong = null; this.started = false;
    if (!song) { this.shuffleFinished = this.mode instanceof ShufflePlayback; this.load(null,false); return; }
    this.load(null,false); await this.play();
  }
  setMode(mode: RepeatMode): void {
    if (mode === 'shuffle' && this.mode instanceof ShufflePlayback) return;
    this.forward.clear(); this.shuffleFinished = false;
    if (this.playlist) this.playlist.repeatMode = mode;
    this.mode = mode === 'one' ? new RepeatOnePlayback(this.output) : mode === 'all' ? new RepeatAllPlayback(this.output) : mode === 'shuffle' ? new ShufflePlayback(this.output) : new NormalPlayback(this.output);
    if (this.mode instanceof ShufflePlayback && this.playlist) this.mode.reset(this.playlist);
    if (this.mode instanceof ShufflePlayback && this.origin?.playlistId === this.playlist?.id && this.started) this.mode.observe(this.origin?.songId);
    this.notify();
  }
  setVolume(volume: number): void { this.volume = Math.max(0, Math.min(1, volume)); this.playback.setVolume(this.volume * this.attenuation); this.notify(); }
  setAttenuation(factor: number): void { this.attenuation = Math.max(0,Math.min(1,factor)); this.playback.setVolume(this.volume*this.attenuation); }
  skipSeconds(seconds: number): void { if (this.duration > 0) this.seek((this.currentTime+seconds)/this.duration); }
  seek(fraction: number): void { this.lastWall = 0; if (this.duration > 0) this.output.seek(Math.max(0, Math.min(1, fraction)) * this.duration); this.notify(); }
  async setEffects(fade: boolean, boost: boolean): Promise<void> {
    const resume = this.state === 'playing'; this.pause(); this.playback.dispose();
    this.fadeEnabled = fade; this.boostEnabled = boost;
    let playback: TrackPlayback = new BasicTrackPlayback(this.output);
    if (boost) playback = new VolumeBoostDecorator(playback, this.configuration.boostFactor);
    if (fade) playback = new FadeInDecorator(playback, this.configuration.fadeDuration);
    this.playback = playback; this.playback.setVolume(this.volume*this.attenuation); if (resume) await this.play(); this.notify();
  }
  dispose(): void { this.stop(); this.playback.dispose(); this.playlist = null; this.queue.clear(); this.clearHistory(); this.output.dispose?.(); }
}
