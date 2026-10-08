import { DoublyLinkedList } from '../structures/DoublyLinkedList';
import type { MusicReference } from '../music/MusicProvider';
export class SpotifyReferenceCollection extends EventTarget {
  readonly tracks = new DoublyLinkedList<MusicReference>();
  add(track: MusicReference): boolean {
    if (track.providerId !== 'spotify' || this.tracks.indexOf(track.id) >= 0 || this.tracks.getSize() >= 100) return false;
    this.tracks.addLast(track); this.changed(); return true;
  }
  remove(id: string): void { this.tracks.removeById(id); this.changed(); }
  move(id: string, offset: number): void { const from = this.tracks.indexOf(id), target = from + offset; if (from >= 0 && target >= 0 && target < this.tracks.getSize()) this.tracks.moveNode(from, target); this.changed(); }
  clear(): void { this.tracks.clear(); this.changed(); }
  private changed(): void { this.tracks.assertIntegrity(); this.dispatchEvent(new Event('change')); }
}
