import { describe, it, expect } from 'vitest';
import { DoublyLinkedList } from '../src/structures/DoublyLinkedList';
const song = (id: string) => ({ id });
function assertLinks(list: DoublyLinkedList<{ id: string }>, expected: string[]): void {
  expect([...list].map(item => item.id)).toEqual(expected);
  expect(list.getSize()).toBe(expected.length);
  expect(list.head?.previous ?? null).toBeNull(); expect(list.tail?.next ?? null).toBeNull();
  let previous = null; let node = list.head; let count = 0;
  while (node) { expect(node.previous).toBe(previous); previous = node; node = node.next; if (++count > expected.length) throw new Error('Cycle detected'); }
  expect(previous).toBe(list.tail);
  const backward: string[] = []; for (let node = list.tail; node; node = node.previous) backward.push(node.song.id);
  expect(backward).toEqual([...expected].reverse());
}
describe('DoublyLinkedList', () => {
  it('starts empty with null boundaries and current', () => { const list = new DoublyLinkedList(); expect(list.isEmpty()).toBe(true); expect(list.current).toBeNull(); assertLinks(list, []); expect(list.moveNext()).toBeNull(); expect(list.movePrevious()).toBeNull(); });
  it('adds the first node to an empty list', () => { const list = new DoublyLinkedList(); list.addFirst(song('a')); assertLinks(list, ['a']); expect(list.current).toBe(list.head); expect(list.head).toBe(list.tail); });
  it('adds last to empty and populated lists', () => { const list = new DoublyLinkedList(); list.addLast(song('a')); assertLinks(list, ['a']); list.addLast(song('b')); assertLinks(list, ['a','b']); });
  it('adds first to a populated list without losing current', () => { const list = new DoublyLinkedList(); list.addLast(song('b')); const current = list.current; list.addFirst(song('a')); assertLinks(list, ['a','b']); expect(list.current).toBe(current); });
  it('inserts in the middle', () => { const list = new DoublyLinkedList(); list.addLast(song('a')); list.addLast(song('c')); list.insertAt(song('b'),1); assertLinks(list, ['a','b','c']); });
  it('inserts at position zero', () => { const list = new DoublyLinkedList(); list.addLast(song('b')); list.insertAt(song('a'),0); assertLinks(list, ['a','b']); });
  it('inserts at size', () => { const list = new DoublyLinkedList(); list.addLast(song('a')); list.insertAt(song('b'),1); assertLinks(list, ['a','b']); });
  it.each([0,1,2])('removes position %i and repairs both directions', position => { const list = new DoublyLinkedList(); for (const id of ['a','b','c']) list.addLast(song(id)); expect(list.removeAt(position).id).toBe(['a','b','c'][position]); assertLinks(list, ['a','b','c'].filter((_, i) => i !== position)); });
  it('removes the only node and detaches it', () => { const list = new DoublyLinkedList(); list.addFirst(song('a')); const removed = list.current!; list.removeAt(0); assertLinks(list, []); expect(list.current).toBeNull(); expect(removed.previous).toBeNull(); expect(removed.next).toBeNull(); });
  it('moves current through next and previous and preserves it at boundaries', () => { const list = new DoublyLinkedList(); for (const id of ['a','b','c']) list.addLast(song(id)); const second = list.head!.next; expect(list.moveNext()?.id).toBe('b'); expect(list.current).toBe(second); expect(list.movePrevious()?.id).toBe('a'); expect(list.movePrevious()).toBeNull(); expect(list.current).toBe(list.head); list.setCurrent('c'); expect(list.moveNext()).toBeNull(); expect(list.current).toBe(list.tail); });
  it('selects by id and leaves selection intact for absent ids', () => { const list = new DoublyLinkedList(); list.addLast(song('a')); expect(list.setCurrent('missing')).toBe(false); expect(list.current?.song.id).toBe('a'); expect(list.setCurrent('a')).toBe(true); });
  it('removes current by choosing successor then predecessor', () => { const list = new DoublyLinkedList(); for (const id of ['a','b','c']) list.addLast(song(id)); list.setCurrent('b'); list.removeById('b'); expect(list.current?.song.id).toBe('c'); list.removeById('c'); expect(list.current?.song.id).toBe('a'); expect(list.removeById('missing')).toBeNull(); assertLinks(list,['a']); });
  it('rejects invalid positions without mutation', () => { const list = new DoublyLinkedList(); list.addLast(song('a')); for (const position of [-1, 2, 0.5, NaN, Infinity]) { expect(() => list.insertAt(song('x'), position)).toThrow(RangeError); } for (const position of [-1,1,0.5]) { expect(() => list.removeAt(position)).toThrow(RangeError); expect(() => list.getAt(position)).toThrow(RangeError); } assertLinks(list,['a']); });
  it('gets nodes from either end', () => { const list = new DoublyLinkedList(); for (const id of ['a','b','c','d']) list.addLast(song(id)); expect(list.getAt(0).id).toBe('a'); expect(list.getAt(3).id).toBe('d'); expect(list.getAt(2).id).toBe('c'); });
  it('clears and allows reuse', () => { const list = new DoublyLinkedList(); for (const id of ['a','b']) list.addLast(song(id)); const oldHead = list.head!; list.clear(); assertLinks(list,[]); expect(oldHead.next).toBeNull(); list.addLast(song('c')); assertLinks(list,['c']); });
  it('maintains invariants over 500 deterministic mixed operations', () => {
    const list = new DoublyLinkedList(); const reference: string[] = []; let seed = 37;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
    for (let i = 0; i < 500; i++) { if (!reference.length || random() % 3 !== 0) { const position = random() % (reference.length + 1); list.insertAt(song(String(i)),position); reference.splice(position,0,String(i)); } else { const position = random() % reference.length; expect(list.removeAt(position).id).toBe(reference.splice(position,1)[0]); } assertLinks(list,reference); }
  });
});
