import type { AudioOutput } from './AudioOutput';
import type { Playlist } from '../../models/Playlist';
import type { Song } from '../../models/Song';
export abstract class PlaybackMode {
  constructor(protected readonly output: AudioOutput) {}
  protected abstract destination(playlist: Playlist): Song | null;
  onEnded(playlist: Playlist): Song | null {
    const song = this.destination(playlist);
    if (song) this.output.load(song.source); else this.output.pause();
    return song;
  }
}
export class NormalPlayback extends PlaybackMode {
  protected destination(playlist: Playlist): Song | null { return playlist.songs.moveNext(); }
}
export class RepeatOnePlayback extends PlaybackMode {
  protected destination(playlist: Playlist): Song | null { return playlist.songs.current?.song ?? null; }
}
export class RepeatAllPlayback extends PlaybackMode {
  protected destination(playlist: Playlist): Song | null {
    const next = playlist.songs.moveNext();
    if (next) return next;
    const first = playlist.songs.head?.song;
    if (!first) return null;
    playlist.songs.setCurrent(first.id); return first;
  }
}

/** A single shuffle cycle selected directly from the existing linked nodes. */
export class ShufflePlayback extends PlaybackMode {
  private readonly visited = new Set<string>();
  constructor(output: AudioOutput, private readonly random: () => number = Math.random) { super(output); }
  reset(playlist: Playlist): void { this.visited.clear(); this.observe(playlist.songs.current?.song.id); }
  observe(id?: string): void { if (id) this.visited.add(id); }
  hasNext(playlist: Playlist): boolean {
    for (const song of playlist.songs) if (!this.visited.has(song.id)) return true;
    return false;
  }
  next(playlist: Playlist): Song | null {
    let selected: Song | null = null, count = 0;
    // Reservoir sampling is uniform without creating or rearranging an array of songs.
    for (let node = playlist.songs.head; node; node = node.next) {
      if (this.visited.has(node.song.id)) continue;
      count++;
      if (this.random() < 1 / count) selected = node.song;
    }
    if (selected) { playlist.songs.setCurrent(selected.id); this.observe(selected.id); }
    return selected;
  }
  protected destination(playlist: Playlist): Song | null { return this.next(playlist); }
}
