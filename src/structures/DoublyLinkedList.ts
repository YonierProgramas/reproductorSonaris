import { SongNode } from './SongNode';
export class DoublyLinkedList<T extends { id: string }> implements Iterable<T> {
  head: SongNode<T> | null = null;
  tail: SongNode<T> | null = null;
  current: SongNode<T> | null = null;
  private size = 0;
  getSize(): number { return this.size; }
  isEmpty(): boolean { return this.size === 0; }
  addFirst(song: T): void { this.insertAt(song, 0); }
  addLast(song: T): void { this.insertAt(song, this.size); }
  insertAt(song: T, position: number): void {
    this.validate(position, true);
    const node = new SongNode(song);
    const next = position === this.size ? null : this.nodeAt(position);
    const previous = next ? next.previous : this.tail;
    node.previous = previous; node.next = next;
    if (previous) previous.next = node; else this.head = node;
    if (next) next.previous = node; else this.tail = node;
    this.size++;
    this.current ??= node;
  }
  private validate(position: number, insertion = false): void {
    if (!Number.isInteger(position) || position < 0 || position >= this.size + Number(insertion)) throw new RangeError('Invalid position');
  }
  private nodeAt(position: number): SongNode<T> {
    this.validate(position);
    let node = position < this.size / 2 ? this.head! : this.tail!;
    if (position < this.size / 2) for (let i = 0; i < position; i++) node = node.next!;
    else for (let i = this.size - 1; i > position; i--) node = node.previous!;
    return node;
  }
  getAt(position: number): T { return this.nodeAt(position).song; }
  removeAt(position: number): T {
    const node = this.nodeAt(position);
    if (node.previous) node.previous.next = node.next; else this.head = node.next;
    if (node.next) node.next.previous = node.previous; else this.tail = node.previous;
    // A removed current node selects its successor, then predecessor, then null.
    if (this.current === node) this.current = node.next ?? node.previous;
    node.previous = null; node.next = null; this.size--;
    return node.song;
  }
  removeById(id: string): T | null {
    let position = 0;
    for (let node = this.head; node; node = node.next, position++) if (node.song.id === id) return this.removeAt(position);
    return null;
  }
  setCurrent(id: string): boolean {
    for (let node = this.head; node; node = node.next) if (node.song.id === id) { this.current = node; return true; }
    return false;
  }
  moveNext(): T | null { if (!this.current?.next) return null; this.current = this.current.next; return this.current.song; }
  movePrevious(): T | null { if (!this.current?.previous) return null; this.current = this.current.previous; return this.current.song; }
  indexOf(id: string): number {
    let index = 0;
    for (let node = this.head; node; node = node.next, index++) if (node.song.id === id) return index;
    return -1;
  }
  moveNode(fromIndex: number, toIndex: number): void {
    this.validate(fromIndex); this.validate(toIndex);
    if (fromIndex === toIndex) return;
    const node = this.nodeAt(fromIndex);
    // Detach and reinsert the same node; current identity and ownership never change.
    if (node.previous) node.previous.next = node.next; else this.head = node.next;
    if (node.next) node.next.previous = node.previous; else this.tail = node.previous;
    this.size--;
    const next = toIndex === this.size ? null : this.nodeAt(toIndex);
    const previous = next ? next.previous : this.tail;
    node.previous = previous; node.next = next;
    if (previous) previous.next = node; else this.head = node;
    if (next) next.previous = node; else this.tail = node;
    this.size++;
  }
  readSnapshot(): readonly Readonly<NodeSnapshot>[] {
    const result: NodeSnapshot[] = [];
    let index = 0;
    for (let node = this.head; node; node = node.next, index++) result.push(Object.freeze({
      id: node.song.id, index, previousId: node.previous?.song.id ?? null,
      nextId: node.next?.song.id ?? null, isHead: node === this.head,
      isTail: node === this.tail, isCurrent: node === this.current,
    }));
    return Object.freeze(result);
  }
  assertIntegrity(): void {
    const visited = new Set<SongNode<T>>();
    let previous: SongNode<T> | null = null;
    for (let node = this.head; node; node = node.next) {
      if (visited.has(node) || node.previous !== previous) throw new Error('Invalid list links');
      visited.add(node); previous = node;
    }
    if (visited.size !== this.size || previous !== this.tail || this.tail?.next || this.head?.previous || (this.current && !visited.has(this.current))) throw new Error('Invalid list boundaries');
    if (!this.size && (this.head || this.tail || this.current)) throw new Error('Invalid empty list');
  }
  clear(): void { while (this.head) this.removeAt(0); }
  *[Symbol.iterator](): Iterator<T> { for (let node = this.head; node; node = node.next) yield node.song; }
}

export interface NodeSnapshot {
  readonly id: string; readonly index: number; readonly previousId: string | null;
  readonly nextId: string | null; readonly isHead: boolean; readonly isTail: boolean; readonly isCurrent: boolean;
}
