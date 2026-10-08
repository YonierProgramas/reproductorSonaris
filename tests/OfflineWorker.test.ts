import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function setup(){
  const handlers=new Map<string,(event:unknown)=>void>();const response=new Response('cached application');
  const cache={addAll:vi.fn(async()=>{}),match:vi.fn(async(_request:unknown,options?:{ignoreVary?:boolean})=>options?.ignoreVary?response:undefined)};
  const caches={open:vi.fn(async()=>cache),keys:vi.fn(async()=>['unrelated','sonaris-shell-old','sonaris-shell-test']),delete:vi.fn(async()=>true)};
  const self={registration:{scope:'http://localhost/'},location:{origin:'http://localhost'},addEventListener:(name:string,handler:(event:unknown)=>void)=>handlers.set(name,handler),skipWaiting:vi.fn(async()=>{}),clients:{claim:vi.fn(async()=>{})}};
  const script=readFileSync('src/offline/worker.js','utf8').replace('__SONARIS_CACHE__','sonaris-shell-test').replace('__SONARIS_ASSETS__','["./","./index.html","./assets/app.js"]');
  runInNewContext(script,{self,caches,URL,Response,fetch:vi.fn(async()=>{throw new Error('Offline');})});return {handlers,cache,caches,response};
}
describe('Offline worker',()=>{
  it('serves immutable own assets despite Vary headers and never intercepts unrelated resources',async()=>{const {handlers,cache,response}=setup();let returned:Promise<Response>|null=null;const respondWith=(value:Promise<Response>)=>{returned=value;};handlers.get('fetch')!({request:{method:'GET',url:'http://localhost/assets/app.js',mode:'cors'},respondWith});expect(await returned).toBe(response);expect(cache.match).toHaveBeenCalledWith(expect.anything(),{ignoreVary:true});returned=null;handlers.get('fetch')!({request:{method:'GET',url:'https://other.example/audio.wav',mode:'cors'},respondWith});expect(returned).toBeNull();handlers.get('fetch')!({request:{method:'GET',url:'http://localhost/private.wav',mode:'cors'},respondWith});expect(returned).toBeNull();});
  it('prepares static URLs and only cleans old Sonaris caches',async()=>{const {handlers,cache,caches}=setup();let work:Promise<void>|null=null;const waitUntil=(value:Promise<void>)=>{work=value;};handlers.get('install')!({waitUntil});await work;expect(cache.addAll).toHaveBeenCalledWith(['http://localhost/','http://localhost/index.html','http://localhost/assets/app.js']);handlers.get('activate')!({waitUntil});await work;expect(caches.delete).toHaveBeenCalledExactlyOnceWith('sonaris-shell-old');});
});
