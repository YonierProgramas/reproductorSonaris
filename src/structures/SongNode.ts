export class SongNode<T> {
  previous: SongNode<T> | null = null;
  next: SongNode<T> | null = null;
  constructor(public readonly song: T) {}
}
