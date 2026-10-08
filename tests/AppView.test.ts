import { describe, it, expect, vi, afterEach } from 'vitest';
import { AppView } from '../src/ui/AppView';
import { PlaylistService } from '../src/services/PlaylistService';
import { AudioPlayerService } from '../src/services/AudioPlayerService';
import { LocalFileSongImporter } from '../src/patterns/factory/SongImporter';
import { FakeOutput, source, song } from './helpers';
afterEach(()=>{document.body.innerHTML='';vi.useRealTimers();});
function setup() {
  const playlists = new PlaylistService({load:()=>[],save:()=>true});
  const player = new AudioPlayerService(new FakeOutput(), {initialVolume:.65,fadeDuration:1000,boostFactor:1.35}); player.attach(playlists.active);
  const root = document.createElement('div'); document.body.append(root);
  new AppView(root,playlists,player,new LocalFileSongImporter({create:()=>source()}));
  return {root,playlists,player};
}
function importFiles(root: HTMLElement, files: File[]): void {
  root.querySelector<HTMLButtonElement>('[data-action="import"]')!.click();
  const input = root.querySelector<HTMLInputElement>('#audio-files')!;
  Object.defineProperty(input,'files',{value:files,configurable:true}); input.dispatchEvent(new Event('change'));
}
describe('AppView integration',()=>{
  it('imports a batch with an invalid file without losing insertion position',()=>{
    vi.useFakeTimers(); const {root,playlists} = setup();
    importFiles(root,[new File(['invalid'],'notes.txt',{type:'text/plain'}),new File(['audio'],'Valid.wav',{type:'audio/wav'}),new File(['audio'],'Next.wav',{type:'audio/wav'})]);
    expect([...playlists.active.songs].map(song=>song.title)).toEqual(['Valid','Next']); expect(root.querySelector('#toast')!.textContent).toContain('1 archivos rechazados'); expect(root.querySelectorAll('.track-row')).toHaveLength(2);
  });
  it('rejects invalid insertion without mutating the list',()=>{
    vi.useFakeTimers(); const {root,playlists} = setup(); const placement = root.querySelector<HTMLSelectElement>('#placement')!; placement.value='position'; placement.dispatchEvent(new Event('change')); root.querySelector<HTMLInputElement>('#position')!.value='0'; root.querySelector<HTMLButtonElement>('[data-action="import"]')!.click(); expect(playlists.active.songs.isEmpty()).toBe(true); expect(root.querySelector('#toast')!.textContent).toContain('entre 1 y 1');
  });
  it('uses addFirst, addLast and insertAt and preserves selected file order',()=>{
    vi.useFakeTimers(); const {root,playlists} = setup(); const list = playlists.active.songs; const first = vi.spyOn(list,'addFirst'); const last = vi.spyOn(list,'addLast'); const insert = vi.spyOn(list,'insertAt');
    importFiles(root,[new File(['audio'],'End.wav',{type:'audio/wav'})]);
    root.querySelector<HTMLSelectElement>('#placement')!.value='first'; importFiles(root,[new File(['audio'],'First.wav',{type:'audio/wav'}),new File(['audio'],'Second.wav',{type:'audio/wav'})]);
    root.querySelector<HTMLSelectElement>('#placement')!.value='position'; root.querySelector<HTMLInputElement>('#position')!.value='3'; importFiles(root,[new File(['audio'],'Middle.wav',{type:'audio/wav'})]);
    expect([...list].map(song=>song.title)).toEqual(['First','Second','Middle','End']); expect(first).toHaveBeenCalled(); expect(last).toHaveBeenCalled(); expect(insert).toHaveBeenCalledWith(expect.objectContaining({title:'Middle'}),2);
  });
  it('escapes user filenames rather than inserting executable HTML',()=>{
    vi.useFakeTimers(); const {root} = setup(); importFiles(root,[new File(['audio'],'<img src=x onerror=alert(1)>.wav',{type:'audio/wav'})]); expect(root.querySelector('.track-title strong')!.textContent).toBe('<img src=x onerror=alert(1)>'); expect(root.querySelector('img')).toBeNull();
  });
  it('search filters rendering without changing structural navigation',()=>{
    const {root,playlists,player} = setup(); playlists.active.songs.addLast(song('Alpha')); playlists.active.songs.addLast(song('Beta')); player.sync(); const search = root.querySelector<HTMLInputElement>('#search')!; search.value='Beta'; search.dispatchEvent(new Event('input')); expect(root.querySelectorAll('.track-row')).toHaveLength(1); expect(playlists.active.songs.getSize()).toBe(2); expect(playlists.active.songs.current?.song.title).toBe('Alpha');
  });
});
