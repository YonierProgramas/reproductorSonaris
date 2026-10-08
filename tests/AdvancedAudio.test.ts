import { describe,it,expect,vi,afterEach } from 'vitest';
import { AudioProcessingService } from '../src/audio/AudioProcessingService';
import { SleepTimerService } from '../src/services/SleepTimerService';
import { AudioPlayerService } from '../src/services/AudioPlayerService';
import { FakeOutput } from './helpers';
afterEach(()=>vi.useRealTimers());
const parameter=()=>({value:0,setTargetAtTime:vi.fn()});
const node=()=>({connect:vi.fn(),disconnect:vi.fn(),gain:parameter(),frequency:parameter(),Q:parameter(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),fftSize:0,smoothingTimeConstant:0,type:''});
describe('Advanced audio',()=>{
  it('creates exactly one serial chain, three filters and a reusable context',async()=>{
    const source=node(),gain=node(),limiter=node(),analyser=node(),filters=[node(),node(),node()];
    const context={state:'suspended',currentTime:0,destination:node(),createMediaElementSource:vi.fn(()=>source),createGain:()=>gain,createDynamicsCompressor:()=>limiter,createAnalyser:()=>analyser,createBiquadFilter:vi.fn().mockReturnValueOnce(filters[0]).mockReturnValueOnce(filters[1]).mockReturnValueOnce(filters[2]),resume:vi.fn(async()=>{}),close:vi.fn(async()=>{})};
    const factory=vi.fn(()=>context as unknown as AudioContext);const processing=new AudioProcessingService(document.createElement('audio'),factory);
    await processing.resume();await processing.resume();expect(factory).toHaveBeenCalledOnce();expect(context.createMediaElementSource).toHaveBeenCalledOnce();expect(source.connect).toHaveBeenCalledExactlyOnceWith(gain);expect(gain.connect).toHaveBeenCalledExactlyOnceWith(filters[0]);expect(filters[2].connect).toHaveBeenCalledWith(limiter);expect(limiter.connect).toHaveBeenCalledWith(analyser);expect(analyser.connect).toHaveBeenCalledWith(context.destination);
    processing.setPreset('rock');expect(filters[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(3,0,.03);processing.setBand('bass',99);expect(processing.gains.bass).toBe(6);expect(processing.preset).toBe('custom');processing.setPreset('normal');expect(processing.gains).toEqual({bass:0,mid:0,treble:0});processing.dispose();expect(source.disconnect).toHaveBeenCalledOnce();expect(context.close).toHaveBeenCalledOnce();
  });
  it('sleep timer fades temporarily, finishes and restores configured volume',()=>{vi.useFakeTimers();const output=new FakeOutput(),player=new AudioPlayerService(output,{initialVolume:.5,fadeDuration:1000,boostFactor:1.35});const timer=new SleepTimerService(player);timer.start(.2);vi.advanceTimersByTime(7000);expect(output.element.volume).toBeCloseTo(.25);expect(player.volume).toBe(.5);vi.advanceTimersByTime(5000);expect(timer.active).toBe(false);expect(player.state).toBe('idle');expect(output.element.volume).toBe(.5);expect(vi.getTimerCount()).toBe(0);});
  it('sleep timer restart and cancellation leave only one or zero intervals',()=>{vi.useFakeTimers();const player=new AudioPlayerService(new FakeOutput(),{initialVolume:.5,fadeDuration:1000,boostFactor:1.35});const timer=new SleepTimerService(player);timer.start(15);timer.start(30);expect(vi.getTimerCount()).toBe(1);player.setVolume(.3);timer.cancel();expect(vi.getTimerCount()).toBe(0);expect(player.volume).toBe(.3);expect(()=>timer.start(0)).toThrow();expect(()=>timer.start(.001)).toThrow();expect(()=>timer.start(NaN)).toThrow();});
});

import { AudioVisualizer } from '../src/ui/AudioVisualizer';
it('visualizer reads analysis data and cancels animation on pause or disable',async()=>{
  const context={clearRect:vi.fn(),fillRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),fillStyle:'',strokeStyle:'',lineWidth:0};
  const getContext=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  let callback: FrameRequestCallback | null=null;const request=vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{callback=fn;return 1;});const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  const analyser={frequencyBinCount:256,getByteFrequencyData:vi.fn((data:Uint8Array)=>data.fill(120)),getByteTimeDomainData:vi.fn((data:Uint8Array)=>data.fill(128))};
  const processing={resume:vi.fn(async()=>{}),analysis:analyser} as unknown as AudioProcessingService;
  const player=new AudioPlayerService(new FakeOutput(),{initialVolume:.5,fadeDuration:1000,boostFactor:1.35});const view=new AudioVisualizer(document.createElement('canvas'),processing,player);
  await view.enable(true);expect(request).not.toHaveBeenCalled();player.state='playing';player.dispatchEvent(new Event('change'));expect(request).toHaveBeenCalledOnce();(callback as unknown as FrameRequestCallback)(0);expect(analyser.getByteFrequencyData).toHaveBeenCalledOnce();view.setMode('wave');(callback as unknown as FrameRequestCallback)(0);expect(analyser.getByteTimeDomainData).toHaveBeenCalledOnce();player.state='paused';player.dispatchEvent(new Event('change'));expect(cancel).toHaveBeenCalled();view.dispose();getContext.mockRestore();request.mockRestore();cancel.mockRestore();
});
