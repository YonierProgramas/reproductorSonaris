import { CommandHistory, EditCommand } from '../patterns/command/CommandHistory';
import type { PlaylistService } from './PlaylistService';
import type { AudioPlayerService } from './AudioPlayerService';
import type { Playlist } from '../models/Playlist';
import type { Song } from '../models/Song';
export class PlaylistEditor extends EventTarget {
  readonly history = new CommandHistory();
  lastOperation = 'La estructura está lista para tu demostración.';
  constructor(readonly playlists: PlaylistService, private readonly player: AudioPlayerService) {
    super(); this.history.addEventListener('change',()=>this.changed());
  }
  private changed(): void {
    for (const playlist of this.playlists.playlists.values()) playlist.songs.assertIntegrity();
    if (this.player.playlist !== this.playlists.active) this.player.attach(this.playlists.active); else this.player.sync();
    this.playlists.save(); this.dispatchEvent(new Event('change'));
  }
  private describe(operation: string): void { this.lastOperation = operation; }
  add(playlist: Playlist, song: Song, position: number, placement = 'position'): void {
    this.history.execute(new EditCommand(()=>{
      song.source.retain();
      if (placement === 'last') playlist.songs.addLast(song);
      else if (position === 0) playlist.songs.addFirst(song);
      else playlist.songs.insertAt(song,position);
      this.describe(position === 0 ? 'Se enlazó un nuevo nodo al inicio: su anterior está vacío.' : position === playlist.songs.getSize()-1 ? 'Se enlazó un nuevo nodo al final: su siguiente está vacío.' : `Se insertó un nodo en la posición ${position+1}; ambos vecinos se reconectaron.`);
    },()=>{this.player.forget(playlist.id,song.id); playlist.songs.removeById(song.id)?.source.release(); this.describe('Se deshizo la inserción y se reconectaron sus vecinos.');},()=>song.source.release(), playlist.id));
  }
  remove(playlist: Playlist, id: string): void {
    const position = playlist.songs.indexOf(id); if (position < 0) return;
    const song = playlist.songs.getAt(position); const selected = playlist.songs.current?.song.id;
    song.source.retain();
    this.history.execute(new EditCommand(()=>{this.player.forget(playlist.id,id); playlist.songs.removeById(id)?.source.release(); this.describe('Se retiró el nodo; sus vecinos se enlazaron entre sí.');},()=>{song.source.retain(); playlist.songs.insertAt(song,position); if (selected) playlist.songs.setCurrent(selected); this.describe('Se restauró el nodo en su posición original.');},()=>song.source.release(), playlist.id));
  }
  move(playlist: Playlist, id: string, target: number): void {
    const from = playlist.songs.indexOf(id); if (from < 0 || from === target || target < 0 || target >= playlist.songs.getSize()) return;
    this.history.execute(new EditCommand(()=>{playlist.songs.moveNode(from,target); this.describe(`Se movió el mismo nodo de la posición ${from+1} a ${target+1}; el nodo actual se conservó.`);},()=>{playlist.songs.moveNode(target,from); this.describe('Se deshizo el movimiento sin recrear nodos.');}, undefined, playlist.id));
  }
  rename(playlist: Playlist, name: string): void {
    if (!name.trim()) throw new Error('Playlist name required');
    const before = playlist.name; this.history.execute(new EditCommand(()=>{playlist.name = name.trim(); this.describe('Se cambió el nombre sin modificar los enlaces.');},()=>{playlist.name=before;}, undefined, playlist.id));
  }
  duplicate(playlist: Playlist): Playlist {
    const copy = playlist.clone(); let applied = false;
    this.history.execute(new EditCommand(()=>{this.playlists.playlists.set(copy.id,copy); this.playlists.select(copy.id); applied=true; this.describe('La copia tiene nodos propios y fuentes de audio compartidas con retención.');},()=>{this.player.forget(copy.id); this.playlists.playlists.delete(copy.id); this.playlists.select(playlist.id); applied=false;},()=>{if (!applied) copy.dispose();}, playlist.id)); return copy;
  }
  delete(playlist: Playlist): void {
    let applied = false; let fallback: Playlist | null = null;
    this.history.execute(new EditCommand(()=>{
      this.player.forget(playlist.id); this.playlists.playlists.delete(playlist.id); applied=true;
      if (![...this.playlists.playlists.values()].some(item => !item.temporary)) { fallback ??= this.playlists.create('Favoritas'); this.playlists.playlists.set(fallback.id,fallback); }
      this.playlists.active = this.playlists.playlists.values().next().value!;
      this.describe('La playlist se retiró y puede restaurarse desde Deshacer.');
    },()=>{ if (fallback) this.playlists.playlists.delete(fallback.id); this.playlists.playlists.set(playlist.id,playlist); this.playlists.select(playlist.id); applied=false; },()=>{if (applied) playlist.dispose(); else fallback?.dispose();}, playlist.id));
  }
  saveSnapshot(playlist: Playlist, name: string): Playlist {
    if (!name.trim() || name.trim().length > 100) throw new Error('Invalid playlist name');
    const previous = [...this.playlists.playlists.values()].find(item => !item.temporary && item.id === this.playlists.active.id) ?? [...this.playlists.playlists.values()].find(item => !item.temporary)!;
    const copy = playlist.clone(); copy.name = name.trim(); let applied = false;
    this.history.execute(new EditCommand(() => { this.playlists.playlists.set(copy.id, copy); this.playlists.select(copy.id); applied = true; this.describe('Se guardó una selección con identificador y nodos independientes.'); }, () => { this.player.forget(copy.id); this.playlists.playlists.delete(copy.id); this.playlists.select(previous.id); applied = false; }, () => { if (!applied) copy.dispose(); }, copy.id));
    return copy;
  }
  navigation(direction: 'next' | 'previous'): void { this.describe(direction==='next'?'El nodo actual recorrió su enlace siguiente.':'El nodo actual recorrió su enlace anterior.'); this.dispatchEvent(new Event('change')); }
  undo(): void { this.history.undo(); }
  redo(): void { this.history.redo(); }
}
