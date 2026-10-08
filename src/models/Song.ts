import { sanitizeMetadata, type SongMetadata } from './SongMetadata';
import type { AudioSource } from '../patterns/adapter/AudioSource';
export class Song {
  savedOffline = false;
  duration = 0;
  private metadataValue: SongMetadata;
  get metadata(): SongMetadata { return this.metadataValue; }
  applyMetadata(metadata: SongMetadata): void { this.metadataValue = sanitizeMetadata(metadata); if (this.metadataValue.title) this.title = this.metadataValue.title; }
  readonly libraryKey: string;
  get artist(): string | null { return this.metadata.artist ?? null; }
  constructor(public title: string, readonly fileName: string, readonly mimeType: string, readonly source: AudioSource, readonly file: File, readonly id: string = crypto.randomUUID(), metadata: SongMetadata = {}, libraryKey?: string) { this.metadataValue = sanitizeMetadata(metadata); this.libraryKey = typeof libraryKey === 'string' && libraryKey.length > 0 && libraryKey.length <= 1000 ? libraryKey : JSON.stringify([file.name, file.size, file.lastModified, file.type]); }
  get sourceUrl(): string { return this.source.url; }
  clone(): Song { this.source.retain(); const song = new Song(this.title, this.fileName, this.mimeType, this.source, this.file, undefined, this.metadata, this.libraryKey); song.duration = this.duration; return song; }
  dispose(): void { this.source.release(); }
}
