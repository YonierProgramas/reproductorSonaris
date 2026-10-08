import type { RepeatMode } from '../models/Playlist';
export interface PlaylistRecord { name: string; description: string; repeatMode: RepeatMode; }
export interface StorageHandler { load(): PlaylistRecord[]; save(records: PlaylistRecord[]): boolean; }
export class BrowserStorageHandler implements StorageHandler {
  load(): PlaylistRecord[] {
    try {
      const records: unknown = JSON.parse(localStorage.getItem('sonaris.playlists') ?? '[]');
      if (!Array.isArray(records)) return [];
      return records.filter((item): item is PlaylistRecord => item && typeof item.name === 'string' && item.name.trim() && typeof item.description === 'string' && ['normal', 'one', 'all', 'shuffle'].includes(item.repeatMode));
    } catch { return []; }
  }
  save(records: PlaylistRecord[]): boolean { try { localStorage.setItem('sonaris.playlists', JSON.stringify(records)); return true; } catch { return false; } }
}
