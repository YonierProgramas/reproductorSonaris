export type EqualizerPreset = 'normal' | 'pop' | 'rock' | 'classical' | 'custom';
export type FrequencyBand = 'bass' | 'mid' | 'treble';
const presets: Record<Exclude<EqualizerPreset,'custom'>, [number,number,number]> = {normal:[0,0,0],pop:[2,-1,2],rock:[3,1,2],classical:[1,0,1]};
export class AudioProcessingService extends EventTarget {
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private filters: Record<FrequencyBand,BiquadFilterNode> | null = null;
  private headroom: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  preset: EqualizerPreset = 'normal';
  readonly gains: Record<FrequencyBand,number> = {bass:0,mid:0,treble:0};
  constructor(private readonly element: HTMLAudioElement, private readonly createContext: ()=>AudioContext = ()=>new AudioContext()) { super(); }
  get available(): boolean { return typeof AudioContext !== 'undefined'; }
  get analysis(): AnalyserNode | null { return this.analyser; }
  get initialized(): boolean { return this.context !== null; }
  async resume(): Promise<void> {
    if (!this.context) {
      const context = this.createContext(); this.context = context;
      const bass = context.createBiquadFilter(); bass.type='lowshelf'; bass.frequency.value=250;
      const mid = context.createBiquadFilter(); mid.type='peaking'; mid.frequency.value=1000; mid.Q.value=.8;
      const treble = context.createBiquadFilter(); treble.type='highshelf'; treble.frequency.value=4000;
      this.filters={bass,mid,treble}; this.headroom=context.createGain(); this.limiter=context.createDynamicsCompressor();
      this.limiter.threshold.value=-3; this.limiter.knee.value=6; this.limiter.ratio.value=12; this.limiter.attack.value=.003; this.limiter.release.value=.15;
      this.analyser=context.createAnalyser(); this.analyser.fftSize=512; this.analyser.smoothingTimeConstant=.8;
      this.source=context.createMediaElementSource(this.element);
      // One source and one serial route: compensation -> EQ -> limiter -> analysis -> destination.
      this.source.connect(this.headroom); this.headroom.connect(bass); bass.connect(mid); mid.connect(treble); treble.connect(this.limiter); this.limiter.connect(this.analyser); this.analyser.connect(context.destination);
      this.apply();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  setBand(band: FrequencyBand, gain: number): void { this.gains[band]=Math.max(-6,Math.min(6,Number.isFinite(gain)?gain:0)); this.preset='custom'; this.apply(); this.dispatchEvent(new Event('change')); }
  setPreset(preset: EqualizerPreset): void {
    this.preset=preset;
    if (preset !== 'custom') { const values=presets[preset]; this.gains.bass=values[0]; this.gains.mid=values[1]; this.gains.treble=values[2]; }
    this.apply(); this.dispatchEvent(new Event('change'));
  }
  private apply(): void {
    if (!this.context || !this.filters || !this.headroom) return;
    let positive = 0;
    for (const band of ['bass','mid','treble'] as const) { const value=this.gains[band]; positive += Math.max(0,value); this.filters[band].gain.setTargetAtTime(value,this.context.currentTime,.03); }
    // Conservatively compensate positive gains before filtering to provide headroom.
    this.headroom.gain.setTargetAtTime(Math.pow(10,-positive/20),this.context.currentTime,.03);
  }
  dispose(): void {
    this.source?.disconnect(); this.headroom?.disconnect(); this.limiter?.disconnect(); this.analyser?.disconnect();
    if (this.filters) for (const filter of Object.values(this.filters)) filter.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(()=>{});
    this.source=null; this.filters=null; this.headroom=null; this.limiter=null; this.analyser=null;
    // A disposed service is not reused: a media element cannot be rebound to a second source.
  }
}
