import type { AudioSource, AudioSourceHandler } from './AudioSource';
export class LocalFileAudioAdapter implements AudioSource {
  readonly url: string;
  private references = 1;
  constructor(readonly file: File) { this.url = URL.createObjectURL(file); }
  retain(): void { if (this.references <= 0) throw new Error('Released audio source'); this.references++; }
  release(): void { if (this.references > 0 && --this.references === 0) URL.revokeObjectURL(this.url); }
}
export class LocalAudioSourceHandler implements AudioSourceHandler {
  create(file: File): AudioSource { return new LocalFileAudioAdapter(file); }
}
