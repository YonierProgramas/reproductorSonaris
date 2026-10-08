import { describe,it,expect,vi,afterEach } from 'vitest';
import { KeyboardShortcutService } from '../src/services/KeyboardShortcutService';
import { PlaylistService } from '../src/services/PlaylistService';
import { PlaylistEditor } from '../src/services/PlaylistEditor';
import { AudioPlayerService } from '../src/services/AudioPlayerService';
import { IndexedDbRepository } from '../src/storage/IndexedDbRepository';
import { FakeOutput,song } from './helpers';
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
function setup(){const playlists=new PlaylistService({load:()=>[],save:()=>true});const output=new FakeOutput(),player=new AudioPlayerService(output,{initialVolume:.5,fadeDuration:1000,boostFactor:1.35});const a=song('A');a.duration=100;playlists.active.songs.addLast(a);player.attach(playlists.active);const editor=new PlaylistEditor(playlists,player),keyboard=new KeyboardShortcutService(player,editor);return {playlists,player,output,editor,keyboard};}
function key(key: string,options: KeyboardEventInit={},target:HTMLElement=document.body){const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event;}
describe('Keyboard shortcuts',()=>{
  it('controls seek, volume, mute, play and undo/redo outside interactive controls',async()=>{const {player,output,editor,playlists,keyboard}=setup();key('ArrowRight');expect(output.seek).toHaveBeenCalledWith(5);key('ArrowUp');expect(player.volume).toBeCloseTo(.55);key('m');expect(player.volume).toBe(0);key('m');expect(player.volume).toBeCloseTo(.55);key(' ');await vi.waitFor(()=>expect(player.state).toBe('playing'));key(' ');expect(player.state).toBe('paused');editor.rename(playlists.active,'Renamed');key('z',{ctrlKey:true});expect(playlists.active.name).toBe('Favoritas');key('z',{ctrlKey:true,shiftKey:true});expect(playlists.active.name).toBe('Renamed');keyboard.dispose();});
  it('ignores form fields, controls, dialogs and reserved modifiers',()=>{const {output,keyboard}=setup();for(const tag of ['input','textarea','select','button','summary']){const control=document.createElement(tag);document.body.append(control);expect(key('ArrowRight',{},control).defaultPrevented).toBe(false);}expect(key('ArrowRight',{altKey:true}).defaultPrevented).toBe(false);expect(key('l',{ctrlKey:true}).defaultPrevented).toBe(false);expect(key('ArrowRight',{metaKey:true}).defaultPrevented).toBe(false);const dialog=document.createElement('dialog');dialog.setAttribute('open','');document.body.append(dialog);key('ArrowRight');expect(output.seek).not.toHaveBeenCalled();keyboard.dispose();});
});
describe('IndexedDbRepository transaction contracts',()=>{
  it('rejects an unavailable database and does not report a successful write',async()=>{const repository=new IndexedDbRepository();await expect(repository.write('library','current',{})).rejects.toThrow('unavailable');await expect(repository.read('statistics','current')).rejects.toThrow('unavailable');});
  it('resolves writes only after commit and serializes subsequent writes',async()=>{
    const transactions: {oncomplete?:()=>void;onabort?:()=>void;error:DOMException|null;objectStore:()=>unknown;abort:()=>void}[]=[];const values=new Map<string,unknown>();
    const database={objectStoreNames:{contains:()=>true},close:vi.fn(),transaction:vi.fn(()=>{const transaction={oncomplete:undefined as (()=>void)|undefined,onabort:undefined as (()=>void)|undefined,error:null as DOMException|null,objectStore:()=>({put:(value:unknown,key:string)=>values.set(key,value),delete:(key:string)=>values.delete(key),get:(key:string)=>({result:values.get(key),error:null})}),abort:()=>transaction.onabort?.()};transactions.push(transaction);return transaction;})};
    const factory={open:vi.fn(()=>{const request={result:database,onsuccess:null as null|(()=>void),onerror:null,onblocked:null,onupgradeneeded:null};queueMicrotask(()=>request.onsuccess?.());return request;})} as unknown as IDBFactory;
    const repository=new IndexedDbRepository(factory);let committed=false;const first=repository.write('library','first',{value:1}).then(()=>{committed=true;});const second=repository.write('library','second',{value:2});await vi.waitFor(()=>expect(transactions).toHaveLength(1));expect(committed).toBe(false);transactions[0].oncomplete?.();await first;await vi.waitFor(()=>expect(transactions).toHaveLength(2));transactions[1].oncomplete?.();await second;expect(values.get('second')).toEqual({value:2});
    const failed=repository.write('library','full',{});const assertion=expect(failed).rejects.toThrow('Full');await vi.waitFor(()=>expect(transactions).toHaveLength(3));transactions[2].error=new DOMException('Full','QuotaExceededError');transactions[2].onabort?.();await assertion;
    const recovery=repository.remove('library','first');await vi.waitFor(()=>expect(transactions).toHaveLength(4));transactions[3].oncomplete?.();await recovery;expect(values.has('first')).toBe(false);
  });
});
