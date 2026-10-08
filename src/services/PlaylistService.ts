import { Playlist } from '../models/Playlist';
import { PlaylistBuilder } from '../patterns/builder/PlaylistBuilder';
import type { StorageHandler } from '../storage/StorageHandler';
export class PlaylistService {
  readonly playlists = new Map<string, Playlist>();
  active: Playlist;
  constructor(private readonly storage: StorageHandler) {
    for (const record of storage.load()) { const playlist = new PlaylistBuilder().withName(record.name).withDescription(record.description).withRepeatMode(record.repeatMode).build(); this.playlists.set(playlist.id, playlist); }
    if (!this.playlists.size) this.create('Favoritas', 'Las canciones que siempre vuelves a escuchar.');
    this.active = this.playlists.values().next().value!;
  }
  create(name: string, description = ''): Playlist {
    const playlist = new PlaylistBuilder().withName(name).withDescription(description).build();
    this.playlists.set(playlist.id, playlist); this.save(); return playlist;
  }
  select(id: string): Playlist { const playlist = this.playlists.get(id); if (!playlist) throw new Error('Unknown playlist'); this.active = playlist; return playlist; }
  rename(name: string): void { if (!name.trim()) throw new Error('Playlist name required'); this.active.name = name.trim(); this.save(); }
  duplicate(): Playlist { const copy = this.active.clone(); this.playlists.set(copy.id, copy); this.save(); return copy; }
  deleteActive(): void {
    const removed = this.active; this.playlists.delete(removed.id); removed.dispose();
    if (!this.playlists.size) this.create('Favoritas');
    this.active = this.playlists.values().next().value!; this.save();
  }
  save(): boolean { return this.storage.save([...this.playlists.values()].filter(playlist => !playlist.temporary).map(({name, description, repeatMode}) => ({ name, description, repeatMode }))); }
  dispose(): void { for (const playlist of this.playlists.values()) playlist.dispose(); }
}
