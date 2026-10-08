import { DoublyLinkedList } from '../structures/DoublyLinkedList';
import { Song } from './Song';
export type RepeatMode = 'normal' | 'one' | 'all' | 'shuffle';
export class Playlist {
  temporary = false;
  readonly songs = new DoublyLinkedList<Song>();
  constructor(public name: string, public description = '', public repeatMode: RepeatMode = 'normal', readonly id: string = crypto.randomUUID()) {
    if (!name.trim()) throw new Error('Playlist name required'); this.name = name.trim();
  }
  clone(): Playlist {
    const copy = new Playlist(this.name + ' (copia)', this.description, this.repeatMode);
    for (const song of this.songs) { const cloned = song.clone(); copy.songs.addLast(cloned); if (song.id === this.songs.current?.song.id) copy.songs.setCurrent(cloned.id); }
    return copy;
  }
  dispose(): void { for (const song of this.songs) song.dispose(); this.songs.clear(); }
}
