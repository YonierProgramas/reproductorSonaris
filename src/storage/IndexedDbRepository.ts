export type RepositoryStore = 'library' | 'statistics';
export interface LocalRepository {
  read<T>(store: RepositoryStore, key: string): Promise<T | undefined>;
  write(store: RepositoryStore, key: string, value: unknown): Promise<void>;
  remove(store: RepositoryStore, key: string): Promise<void>;
}
export class IndexedDbRepository implements LocalRepository {
  private database: Promise<IDBDatabase> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}
  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database=new Promise((resolve,reject)=>{
      if (!this.factory) { reject(new Error('IndexedDB unavailable'));return; }
      const request=this.factory.open('sonaris.local',1); let failed=false;
      request.onupgradeneeded=()=>{for(const name of ['library','statistics'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
      request.onerror=()=>{failed=true;reject(request.error??new Error('Database unavailable'));};
      request.onblocked=()=>{failed=true;reject(new Error('Database blocked'));};
      request.onsuccess=()=>{if(failed){request.result.close();return;}request.result.onversionchange=()=>{request.result.close();this.database=null;};resolve(request.result);};
    });
    this.database.catch(()=>{this.database=null;});return this.database;
  }
  async read<T>(store: RepositoryStore,key: string): Promise<T | undefined> {
    const database=await this.open();return new Promise((resolve,reject)=>{
      const transaction=database.transaction(store,'readonly');const request=transaction.objectStore(store).get(key);
      transaction.oncomplete=()=>resolve(request.result as T|undefined);
      transaction.onabort=()=>reject(transaction.error??request.error??new Error('Database read aborted'));
    });
  }
  private mutate(store: RepositoryStore,action: (objectStore: IDBObjectStore)=>void): Promise<void> {
    const next=this.writes.catch(()=>{}).then(async()=>{
      const database=await this.open();await new Promise<void>((resolve,reject)=>{
        const transaction=database.transaction(store,'readwrite');
        transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error??new Error('Database write aborted'));
        try{action(transaction.objectStore(store));}catch(error){transaction.abort();reject(error);}
      });
    });this.writes=next;return next;
  }
  write(store: RepositoryStore,key: string,value: unknown): Promise<void> { return this.mutate(store,objectStore=>{objectStore.put(value,key);}); }
  remove(store: RepositoryStore,key: string): Promise<void> { return this.mutate(store,objectStore=>{objectStore.delete(key);}); }
}
