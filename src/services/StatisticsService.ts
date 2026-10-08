import type { LocalRepository } from '../storage/IndexedDbRepository';
import type { AudioPlayerService } from './AudioPlayerService';
export interface ListeningEvent {sessionId: string; songId: string; playlistId: string; playlistName: string; title: string; seconds: number;}
export interface SongStatistics {id: string;title: string;plays: number;seconds: number;}
export interface StatisticsRecord {
  version: 1; threshold: number; totalSeconds: number; totalPlays: number;
  songs: Record<string,SongStatistics>; playlists: Record<string,{name:string;seconds:number;plays:number}>;
  days: Record<string,number>; recent: {title:string;date:string}[];
}
export class StatisticsService extends EventTarget {
  private state: StatisticsRecord={version:1,threshold:5,totalSeconds:0,totalPlays:0,songs:{},playlists:{},days:{},recent:[]};
  private sessions=new Map<string,{seconds:number;counted:boolean}>();
  private timer: ReturnType<typeof setTimeout> | null=null;
  private readonly listener: EventListener;
  constructor(private readonly repository: LocalRepository, private readonly player: AudioPlayerService, private readonly now: ()=>Date=()=>new Date()) {
    super();this.listener=event=>this.record((event as CustomEvent<ListeningEvent>).detail);player.addEventListener('listening',this.listener);
  }
  get snapshot(): StatisticsRecord {return JSON.parse(JSON.stringify(this.state)) as StatisticsRecord;}
  async restore(): Promise<void> {
    const saved=await this.repository.read<StatisticsRecord>('statistics','current');
    if(saved){
      const nonnegative=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
      const record=(value:unknown):boolean=>!!value&&typeof value==='object'&&!Array.isArray(value);
      if(saved.version!==1 || !nonnegative(saved.totalSeconds) || !nonnegative(saved.totalPlays) || !record(saved.songs) || !record(saved.playlists) || !record(saved.days) || !Array.isArray(saved.recent)
        || !Object.values(saved.songs).every(song=>song && typeof song.id==='string' && typeof song.title==='string' && nonnegative(song.plays) && nonnegative(song.seconds))
        || !Object.values(saved.playlists).every(playlist=>playlist && typeof playlist.name==='string' && nonnegative(playlist.seconds) && nonnegative(playlist.plays))
        || !Object.values(saved.days).every(nonnegative)
        || !saved.recent.every(entry=>entry && typeof entry.title==='string' && typeof entry.date==='string' && Number.isFinite(Date.parse(entry.date)))) throw new Error('Invalid statistics record');
      this.state=saved;
    }
    this.setThreshold(this.state.threshold,false);this.dispatchEvent(new Event('change'));
  }
  setThreshold(seconds: number,persist=true): void {this.state.threshold=Number.isFinite(seconds)?Math.max(1,Math.min(60,seconds)):5;if(persist)this.schedule();this.dispatchEvent(new Event('change'));}
  record(event: ListeningEvent): void {
    if(!event.sessionId || !event.songId || !event.playlistId || !Number.isFinite(event.seconds) || event.seconds<=0)return;
    const seconds=Math.min(5,event.seconds);let session=this.sessions.get(event.sessionId);
    if(!session){session={seconds:0,counted:false};this.sessions.set(event.sessionId,session);if(this.sessions.size>200)this.sessions.delete(this.sessions.keys().next().value!);}
    session.seconds+=seconds;
    const song=this.state.songs[event.songId]??={id:event.songId,title:event.title,plays:0,seconds:0};
    const playlist=this.state.playlists[event.playlistId]??={name:event.playlistName,seconds:0,plays:0};
    const date=this.now();const day=new Intl.DateTimeFormat('sv-SE').format(date);
    song.seconds+=seconds;playlist.seconds+=seconds;this.state.totalSeconds+=seconds;this.state.days[day]=(this.state.days[day]??0)+seconds;
    if(!session.counted && session.seconds>=this.state.threshold){session.counted=true;song.plays++;playlist.plays++;this.state.totalPlays++;this.state.recent.unshift({title:event.title,date:date.toISOString()});this.state.recent.length=Math.min(12,this.state.recent.length);}
    this.schedule();this.dispatchEvent(new Event('change'));
  }
  private schedule(): void {if(this.timer!==null)return;this.timer=setTimeout(()=>{this.timer=null;void this.flush().catch(()=>{});},1000);}
  async flush(): Promise<void> {if(this.timer!==null)clearTimeout(this.timer);this.timer=null;try{await this.repository.write('statistics','current',this.snapshot);}catch(error){this.dispatchEvent(new CustomEvent('storageerror',{detail:error}));throw error;}}
  dispose(): void {this.player.removeEventListener('listening',this.listener);if(this.timer!==null)clearTimeout(this.timer);this.timer=null;}
}
