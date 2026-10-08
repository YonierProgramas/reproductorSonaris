import { DoublyLinkedList } from '../structures/DoublyLinkedList';
import type { Song } from '../models/Song';
export interface PlaybackEntry { id: string; song: Song; songId: string; playlistId: string; playlistName: string; }
export class PlaybackQueue extends EventTarget {
  readonly entries = new DoublyLinkedList<PlaybackEntry>();
  add(song: Song, playlistId: string, playlistName: string, first = false): void {
    const entry = {id: crypto.randomUUID(), song: song.clone(), songId: song.id, playlistId, playlistName};
    if (first) this.entries.addFirst(entry); else this.entries.addLast(entry);
    this.notify();
  }
  take(): PlaybackEntry | null { const entry = this.entries.isEmpty() ? null : this.entries.removeAt(0); this.notify(); return entry; }
  remove(id: string): void { this.entries.removeById(id)?.song.dispose(); this.notify(); }
  move(id: string, offset: number): void { const index = this.entries.indexOf(id); const target = index + offset; if (index >= 0 && target >= 0 && target < this.entries.getSize()) this.entries.moveNode(index,target); this.notify(); }
  forget(playlistId: string, songId?: string): void { for (const entry of [...this.entries]) if (entry.playlistId === playlistId && (!songId || entry.songId === songId)) this.remove(entry.id); }
  clear(): void { for (const entry of this.entries) entry.song.dispose(); this.entries.clear(); this.notify(); }
  private notify(): void { this.dispatchEvent(new Event('change')); }
}
