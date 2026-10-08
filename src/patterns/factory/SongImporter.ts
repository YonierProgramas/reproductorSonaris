import { sanitizeMetadata, type SongMetadata } from '../../models/SongMetadata';
import { Song } from '../../models/Song';
import type { AudioSourceHandler } from '../adapter/AudioSource';
export abstract class SongImporter {
  import(file: File, id?: string, metadata?: SongMetadata, libraryKey?: string): Song { this.validate(file); return this.createSong(file, id, metadata, libraryKey); }
  protected abstract validate(file: File): void;
  protected abstract createSong(file: File, id?: string, metadata?: SongMetadata, libraryKey?: string): Song;
}
export class LocalFileSongImporter extends SongImporter {
  constructor(private readonly sources: AudioSourceHandler) { super(); }
  protected validate(file: File): void {
    if (!file.size || (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|aac|flac|opus|webm)$/i.test(file.name))) throw new Error('Unsupported file');
  }
  protected createSong(file: File, id?: string, metadata?: SongMetadata, libraryKey?: string): Song { const clean = sanitizeMetadata(metadata); return new Song(clean.title ?? file.name.replace(/\.[^.]+$/, ''), file.name, file.type, this.sources.create(file), file, id, clean, libraryKey); }
}
