import type { AudioOutput } from '../bridge/AudioOutput';
export interface TrackPlayback { play(): Promise<void>; pause(): void; setVolume(volume: number): void; dispose(): void; }
export class BasicTrackPlayback implements TrackPlayback {
  constructor(private readonly output: AudioOutput) {}
  play(): Promise<void> { return this.output.play(); }
  pause(): void { this.output.pause(); }
  setVolume(volume: number): void { this.output.setVolume(volume); }
  dispose(): void { this.pause(); }
}
export abstract class TrackPlaybackDecorator implements TrackPlayback {
  constructor(protected readonly wrapped: TrackPlayback) {}
  play(): Promise<void> { return this.wrapped.play(); }
  pause(): void { this.wrapped.pause(); }
  setVolume(volume: number): void { this.wrapped.setVolume(volume); }
  dispose(): void { this.wrapped.dispose(); }
}
export class VolumeBoostDecorator extends TrackPlaybackDecorator {
  constructor(wrapped: TrackPlayback, private readonly factor = 1.35) { super(wrapped); }
  setVolume(volume: number): void { super.setVolume(Math.min(1, volume * this.factor)); }
}
export class FadeInDecorator extends TrackPlaybackDecorator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private volume = 0.65;
  private progress = 1;
  constructor(wrapped: TrackPlayback, private readonly duration = 1600) { super(wrapped); }
  private cancel(): void { if (this.timer !== null) clearInterval(this.timer); this.timer = null; }
  setVolume(volume: number): void { this.volume = volume; super.setVolume(volume * this.progress); }
  async play(): Promise<void> {
    this.cancel(); const generation = ++this.generation; this.progress = 0; super.setVolume(0);
    try { await super.play(); } catch (error) { if (generation === this.generation) { this.progress = 1; super.setVolume(this.volume); } throw error; }
    if (generation !== this.generation) return;
    const start = Date.now();
    this.timer = setInterval(() => {
      this.progress = Math.min(1, (Date.now() - start) / this.duration);
      super.setVolume(this.volume * this.progress);
      if (this.progress === 1) this.cancel();
    }, 40);
  }
  pause(): void { this.generation++; this.cancel(); this.progress = 1; super.setVolume(this.volume); super.pause(); }
  dispose(): void { this.generation++; this.cancel(); super.dispose(); }
}
