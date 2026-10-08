import { vi } from 'vitest';
import type { AudioOutput } from '../src/patterns/bridge/AudioOutput';
import type { AudioSource } from '../src/patterns/adapter/AudioSource';
import { Song } from '../src/models/Song';
export const source = (): AudioSource => ({ url: 'blob:test', retain: vi.fn(), release: vi.fn() });
export const song = (name = 'Track'): Song => new Song(name, `${name}.wav`, 'audio/wav', source(), new File(['audio'],`${name}.wav`,{type:'audio/wav'}));
export class FakeOutput implements AudioOutput {
  readonly element = document.createElement('audio');
  load = vi.fn((_source: AudioSource | null) => { this.element.currentTime = 0; });
  play = vi.fn(async () => { this.element.dispatchEvent(new Event('play')); });
  pause = vi.fn(() => { this.element.dispatchEvent(new Event('pause')); });
  seek = vi.fn((time: number) => { this.element.currentTime = time; });
  setVolume = vi.fn((volume: number) => { this.element.volume = volume; });
}
