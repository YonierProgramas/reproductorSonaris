import { AudioProcessingService } from '../../audio/AudioProcessingService';
import type { AudioSource } from '../adapter/AudioSource';
export interface AudioOutput {
  readonly element: HTMLAudioElement;
  load(source: AudioSource | null): void;
  dispose?(): void;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
}
export class WebAudioOutput implements AudioOutput {
  readonly element = new Audio();
  readonly processing = new AudioProcessingService(this.element);
  constructor() { this.element.preload = 'metadata'; }
  load(source: AudioSource | null): void {
    this.pause();
    if (source) this.element.src = source.url; else this.element.removeAttribute('src');
    this.element.load();
  }
  async play(): Promise<void> {
    const resume = this.processing.available ? this.processing.resume() : Promise.resolve();
    const play = this.element.play();
    await Promise.all([resume,play]);
  }
  dispose(): void { this.pause(); this.processing.dispose(); }
  pause(): void { this.element.pause(); }
  seek(time: number): void { this.element.currentTime = time; }
  setVolume(volume: number): void { this.element.volume = Math.max(0, Math.min(1, volume)); }
}
