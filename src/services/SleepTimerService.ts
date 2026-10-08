import type { AudioPlayerService } from './AudioPlayerService';
export class SleepTimerService extends EventTarget {
  private interval: ReturnType<typeof setInterval> | null = null;
  private deadline = 0;
  private fadingSeconds = 10;
  constructor(private readonly player: AudioPlayerService, private readonly now: ()=>number=()=>Date.now()) { super(); }
  get remainingSeconds(): number { return Math.max(0,(this.deadline-this.now())/1000); }
  get active(): boolean { return this.interval !== null; }
  start(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes<0.01 || minutes>1440) throw new RangeError('Invalid sleep duration');
    this.cancel(); this.deadline=this.now()+minutes*60000; this.fadingSeconds=Math.min(10,minutes*60);
    this.interval=setInterval(()=>this.tick(),250); this.tick();
  }
  private tick(): void {
    const remaining=this.remainingSeconds;
    this.player.setAttenuation(Math.min(1,remaining/this.fadingSeconds));
    if (remaining<=0) { this.player.stop(); this.cancel(); this.dispatchEvent(new Event('finished')); }
    this.dispatchEvent(new Event('change'));
  }
  cancel(): void { if(this.interval!==null)clearInterval(this.interval);this.interval=null;this.deadline=0;this.player.setAttenuation(1);this.dispatchEvent(new Event('change')); }
  dispose(): void { this.cancel(); }
}
