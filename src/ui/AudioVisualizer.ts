import type { AudioProcessingService } from '../audio/AudioProcessingService';
import type { AudioPlayerService } from '../services/AudioPlayerService';
export type VisualizationMode = 'bars' | 'wave';
export class AudioVisualizer {
  private frame: number | null = null;
  enabled = false;
  mode: VisualizationMode = 'bars';
  private visible = true;
  private readonly changed = ()=>this.sync();
  private readonly visibilityChanged = ()=>this.sync();
  constructor(private readonly canvas: HTMLCanvasElement, private readonly processing: AudioProcessingService, private readonly player: AudioPlayerService) {
    player.addEventListener('change',this.changed); document.addEventListener('visibilitychange',this.visibilityChanged);
    this.drawIdle();
  }
  async enable(enabled: boolean): Promise<void> { if (enabled) await this.processing.resume(); this.enabled=enabled; this.sync(); }
  setMode(mode: VisualizationMode): void { this.mode=mode; this.sync(); }
  setVisible(visible: boolean): void { this.visible=visible; this.sync(); }
  private sync(): void {
    const active=this.enabled && this.visible && !document.hidden && this.player.state==='playing';
    if (!active) { if (this.frame !== null) cancelAnimationFrame(this.frame); this.frame=null; this.drawIdle(); }
    else if (this.frame===null) this.frame=requestAnimationFrame(()=>this.draw());
  }
  private drawIdle(): void {
    const context=this.canvas.getContext('2d'); if (!context) return;
    context.clearRect(0,0,this.canvas.width,this.canvas.height); context.fillStyle='#f0f3ff'; context.fillRect(0,0,this.canvas.width,this.canvas.height);
    context.strokeStyle='#bcc9ed'; context.beginPath(); context.moveTo(0,this.canvas.height/2); context.lineTo(this.canvas.width,this.canvas.height/2); context.stroke();
  }
  private draw(): void {
    this.frame=null;
    const analyser=this.processing.analysis,context=this.canvas.getContext('2d');
    if (!analyser || !context) return;
    const data=new Uint8Array(analyser.frequencyBinCount);
    context.fillStyle='#f2f5ff'; context.fillRect(0,0,this.canvas.width,this.canvas.height);
    if (this.mode==='bars') {
      analyser.getByteFrequencyData(data); context.fillStyle='#8294d4';
      const bars=48,width=this.canvas.width/bars;
      for(let i=0;i<bars;i++){const height=data[Math.floor(i*data.length/bars)]/255*this.canvas.height;context.fillRect(i*width,this.canvas.height-height,width-3,height);}
    } else {
      analyser.getByteTimeDomainData(data); context.strokeStyle='#7187ce'; context.lineWidth=2; context.beginPath();
      for(let i=0;i<data.length;i++){const x=i/(data.length-1)*this.canvas.width,y=data[i]/255*this.canvas.height;if(i===0)context.moveTo(x,y);else context.lineTo(x,y);} context.stroke();
    }
    this.sync();
  }
  dispose(): void { this.enabled=false; this.sync(); this.player.removeEventListener('change',this.changed); document.removeEventListener('visibilitychange',this.visibilityChanged); }
}
