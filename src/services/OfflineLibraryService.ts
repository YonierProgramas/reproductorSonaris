import type { LocalRepository } from '../storage/IndexedDbRepository';
import type { PlaylistService } from './PlaylistService';
import type { SongImporter } from '../patterns/factory/SongImporter';
import { PlaylistBuilder } from '../patterns/builder/PlaylistBuilder';
import type { RepeatMode, Playlist } from '../models/Playlist';
import type { SongMetadata } from '../models/SongMetadata';
import type { Song } from '../models/Song';
interface StoredSong { id: string; fileName: string; mimeType: string; duration: number; file: Blob | null; metadata?: SongMetadata; libraryKey?: string; lastModified?: number; }
interface StoredPlaylist { id: string; name: string; description: string; repeatMode: RepeatMode; currentId: string | null; songs: StoredSong[]; }
export interface LibrarySnapshot { version: 1; activeId: string; playlists: StoredPlaylist[]; }
const validId=(id: unknown): id is string=>typeof id==='string' && /^[\w-]{1,100}$/.test(id);
export class OfflineLibraryService extends EventTarget {
  private authorized=new Set<string>();
  private enabled=false;
  missingFiles=0;
  busy=false;
  status='Los archivos solo se conservarán cuando tú lo elijas.';
  constructor(private readonly repository: LocalRepository,private readonly playlists: PlaylistService,private readonly importer: SongImporter) {super();}
  async restore(): Promise<void> {
    const snapshot=await this.repository.read<LibrarySnapshot>('library','current');
    if(!snapshot || snapshot.version!==1 || !Array.isArray(snapshot.playlists))return;
    const restored: Playlist[]=[];this.missingFiles=0;
    try{
      for(const record of snapshot.playlists){
        if(!validId(record.id)||typeof record.name!=='string'||!record.name.trim()||!['normal','one','all','shuffle'].includes(record.repeatMode)||!Array.isArray(record.songs))continue;
        const playlist=new PlaylistBuilder().withId(record.id).withName(record.name).withDescription(typeof record.description==='string'?record.description:'').withRepeatMode(record.repeatMode).build();
        restored.push(playlist);
        for(const saved of record.songs){
          if(!validId(saved.id)||!(saved.file instanceof Blob)||!saved.file.size){this.missingFiles++;continue;}
          try{const file=new File([saved.file],saved.fileName,{type:saved.mimeType,lastModified:saved.lastModified??0});const song=this.importer.import(file,saved.id,saved.metadata,saved.libraryKey);song.duration=Number.isFinite(saved.duration)?Math.max(0,saved.duration):0;song.savedOffline=true;this.authorized.add(song.id);playlist.songs.addLast(song);}catch{this.missingFiles++;}
        }
        if(record.currentId)playlist.songs.setCurrent(record.currentId);playlist.songs.assertIntegrity();
      }
      if(restored.length){this.playlists.dispose();this.playlists.playlists.clear();for(const playlist of restored)this.playlists.playlists.set(playlist.id,playlist);this.playlists.active=this.playlists.playlists.get(snapshot.activeId)??restored[0];this.playlists.save();this.enabled=true;}
    }catch(error){for(const playlist of restored)playlist.dispose();throw error;}
    this.status=this.missingFiles?`Biblioteca recuperada. ${this.missingFiles} archivos no estaban conservados; selecciónalos de nuevo.`:'Biblioteca local recuperada.';this.notify();
  }
  private snapshot(): LibrarySnapshot {
    return {version:1,activeId:this.playlists.active.temporary ? ([...this.playlists.playlists.values()].find(item=>!item.temporary)?.id??'') : this.playlists.active.id,playlists:[...this.playlists.playlists.values()].filter(item=>!item.temporary).map(playlist=>({id:playlist.id,name:playlist.name,description:playlist.description,repeatMode:playlist.repeatMode,currentId:playlist.songs.current?.song.id??null,songs:[...playlist.songs].map(song=>({id:song.id,fileName:song.fileName,mimeType:song.mimeType,duration:song.duration,metadata:song.metadata,libraryKey:song.libraryKey,lastModified:song.file.lastModified,file:this.authorized.has(song.id)?song.file:null}))}))};
  }
  async persistMetadata(): Promise<void> {if(!this.enabled)return;for(const playlist of this.playlists.playlists.values())for(const song of playlist.songs)song.savedOffline=this.authorized.has(song.id);await this.write();this.notify();}
  private async write(): Promise<void> {
    try{await this.repository.write('library','current',this.snapshot());this.enabled=true;}
    catch(error){this.status=(error as {name?:string})?.name==='QuotaExceededError'?'El almacenamiento está lleno. Elimina archivos guardados o libera espacio; la sesión sigue funcionando.':'No se pudo guardar la biblioteca local. La sesión sigue funcionando.';this.notify();throw error;}
  }
  async savePlaylist(playlist: Playlist): Promise<void> {if(playlist.temporary)throw new Error('Save temporary playlist first');await this.setSaved([...playlist.songs],true);}
  async setSaved(songs: Song[],saved: boolean): Promise<void> {
    if(this.busy)throw new Error('Storage busy');this.busy=true;this.notify();
    const previous=new Set(this.authorized);
    try{for(const song of songs){if(saved)this.authorized.add(song.id);else this.authorized.delete(song.id);}await this.write();for(const song of songs)song.savedOffline=this.authorized.has(song.id);this.status=saved?'Canciones conservadas en este navegador.':'Archivos eliminados del almacenamiento; siguen disponibles en esta sesión.';}
    catch(error){this.authorized=previous;throw error;}finally{this.busy=false;this.notify();}
  }
  async clearAudio(): Promise<void> {
    const songs=[...this.playlists.playlists.values()].flatMap(playlist=>[...playlist.songs]);const previous=new Set(this.authorized);this.authorized.clear();
    try{await this.write();for(const song of songs)song.savedOffline=false;this.status='Archivos guardados eliminados. La configuración se conserva.';this.notify();}catch(error){this.authorized=previous;throw error;}
  }
  async requestPersistence(): Promise<boolean> {const allowed=await navigator.storage?.persist?.()??false;this.status=allowed?'El navegador concedió almacenamiento persistente.':'El navegador no concedió persistencia; puedes seguir usando el almacenamiento local.';this.notify();return allowed;}
  async estimate(): Promise<StorageEstimate | null> {return await navigator.storage?.estimate?.()??null;}
  private notify(): void {this.dispatchEvent(new Event('change'));}
}
