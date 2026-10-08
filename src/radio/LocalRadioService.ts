import { Playlist } from '../models/Playlist';
import type { Song } from '../models/Song';
import { PlaylistBuilder } from '../patterns/builder/PlaylistBuilder';
import type { PlaylistService } from '../services/PlaylistService';
import type { PlaylistEditor } from '../services/PlaylistEditor';
import type { AudioPlayerService } from '../services/AudioPlayerService';
import { LocalRecommendationEngine, seededRandom, type Recommendation } from './LocalRecommendationEngine';
export class LocalRadioService extends EventTarget {
  playlist: Playlist | null = null;
  seed: Song | null = null;
  automatic = false;
  continuous = true;
  selectionSeed = 1;
  batchSize = 12;
  status = 'Crea una radio con canciones de tu biblioteca local.';
  readonly explanations = new Map<string, Recommendation>();
  private excluded = new Set<string>();
  private random = seededRandom(1);
  private previousPlaylistId: string | null = null;
  private filling = false;
  private radioMode = true;
  private readonly trackStarted = () => { if (this.player.playlist === this.playlist && this.playlist && this.continuous && this.radioMode) this.fillIfNeeded(); };
  constructor(readonly library: PlaylistService, private readonly player: AudioPlayerService, private readonly editor: PlaylistEditor, private readonly engine = new LocalRecommendationEngine()) {
    super();
    try { const config = JSON.parse(localStorage.getItem('sonaris.radio') ?? '{}') as Record<string, unknown>; this.automatic = config.automatic === true; this.continuous = config.continuous !== false; } catch { /* Defaults also work when storage is unavailable. */ }
    player.addEventListener('trackstart', this.trackStarted);
  }
  *songs(): IterableIterator<Song> {
    const unique = new Set<string>();
    for (const playlist of this.library.playlists.values()) if (!playlist.temporary) for (const song of playlist.songs) if (!unique.has(song.libraryKey)) { unique.add(song.libraryKey); yield song; }
  }
  find(id: string): Song | null { for (const song of this.songs()) if (song.id === id) return song; return null; }
  configure(automatic: boolean, continuous: boolean): void {
    this.automatic = automatic; this.continuous = continuous;
    try { localStorage.setItem('sonaris.radio', JSON.stringify({ automatic, continuous })); } catch { this.status = 'La configuración se aplicó en esta sesión; el navegador no permite guardarla.'; }
    this.notify();
  }
  start(seed: Song, selectionSeed = this.selectionSeed, batchSize = this.batchSize, radioMode = true): Playlist {
    if (!Number.isInteger(selectionSeed) || selectionSeed < 0 || selectionSeed > 0xffffffff || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error('Invalid radio configuration');
    // Retain before ending the preceding session: its seed may be the only remaining owner.
    const retainedSeed = seed.clone(); this.end(false);
    this.previousPlaylistId = this.library.active.id; this.selectionSeed = selectionSeed; this.batchSize = batchSize; this.radioMode = radioMode;
    this.random = seededRandom(selectionSeed); this.excluded = new Set([retainedSeed.libraryKey]); this.explanations.clear();
    const playlist = new PlaylistBuilder().withName(radioMode ? 'Radio de Sonaris' : 'Escucha temporal').withDescription(`Basada en esta canción: ${retainedSeed.title}`).build(); playlist.temporary = true; playlist.songs.addLast(retainedSeed);
    this.playlist = playlist; this.seed = retainedSeed; this.library.playlists.set(playlist.id, playlist); this.library.select(playlist.id);
    if (radioMode) this.appendBatch(); else this.status = 'Escucha temporal. Puedes crear una radio de esta canción.';
    this.player.attach(playlist); this.notify(); return playlist;
  }
  async preview(song: Song): Promise<boolean> { this.start(song, this.selectionSeed, this.batchSize, this.automatic); return this.player.play(); }
  private appendBatch(): number {
    if (!this.playlist || !this.seed || this.filling) return 0;
    this.filling = true;
    try {
      const selections = this.engine.select(this.seed, this.songs(), this.excluded, this.batchSize, this.random);
      for (const recommendation of selections) { this.playlist.songs.addLast(recommendation.song.clone()); this.excluded.add(recommendation.song.libraryKey); this.explanations.set(recommendation.song.libraryKey, recommendation); }
      this.playlist.songs.assertIntegrity();
      this.status = selections.length ? `${selections.length} canciones añadidas desde tu biblioteca. No se repiten archivos dentro de esta radio.` : 'No encontramos más canciones relacionadas. Puedes importar más archivos o agregarlos manualmente.';
      return selections.length;
    } finally { this.filling = false; }
  }
  fillIfNeeded(): void {
    if (!this.playlist || this.player.playlist !== this.playlist || !this.continuous || !this.radioMode) return;
    let remaining = 0;
    for (let node = this.playlist.songs.current?.next; node && remaining < 3; node = node.next) remaining++;
    if (remaining < 3) { const previousStatus = this.status; const added = this.appendBatch(); if (added || this.status !== previousStatus) this.notify(); }
  }
  regenerate(): void {
    if (!this.playlist || !this.seed) return;
    const seed = this.seed;
    this.start(seed, this.selectionSeed, this.batchSize, true);
  }
  add(song: Song): boolean {
    if (!this.playlist || this.excluded.has(song.libraryKey)) { this.status = 'Esta canción ya se incluyó en la radio.'; this.notify(); return false; }
    this.editor.add(this.playlist, song.clone(), this.playlist.songs.getSize(), 'last'); this.excluded.add(song.libraryKey);
    this.explanations.set(song.libraryKey, { song, score: 0, reasons: ['Agregada por ti'] }); this.status = 'Canción agregada a la radio.'; this.notify(); return true;
  }
  save(name: string): Playlist {
    if (!this.playlist) throw new Error('No active radio');
    const copy = this.editor.saveSnapshot(this.playlist, name); this.status = 'Radio guardada como playlist con nodos independientes.'; this.notify(); return copy;
  }
  end(notify = true): void {
    const playlist = this.playlist; if (!playlist) return;
    this.playlist = null; this.seed = null;
    this.player.forget(playlist.id); this.library.playlists.delete(playlist.id);
    if (this.library.active === playlist) this.library.active = this.library.playlists.get(this.previousPlaylistId ?? '') ?? [...this.library.playlists.values()].find(item => !item.temporary) ?? this.library.create('Favoritas');
    if (this.player.playlist === playlist) this.player.attach(this.library.active);
    this.editor.history.discardScope(playlist.id); playlist.dispose(); this.excluded.clear(); this.explanations.clear();
    this.status = 'Radio finalizada. Tus playlists originales se conservan.'; if (notify) this.notify();
  }
  get isRadio(): boolean { return this.radioMode; }
  private notify(): void { this.dispatchEvent(new Event('change')); }
  dispose(): void { this.player.removeEventListener('trackstart', this.trackStarted); this.end(false); }
}
