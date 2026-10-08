import type { PlaylistService } from '../services/PlaylistService';
import type { AudioPlayerService } from '../services/AudioPlayerService';
import type { MusicCatalogProvider, MusicPlaybackProvider, CatalogPage, MusicReference } from './MusicProvider';
export class LocalMusicProvider implements MusicCatalogProvider, MusicPlaybackProvider {
  readonly providerId = 'local';
  constructor(private readonly playlists: PlaylistService, private readonly player: AudioPlayerService) {}
  async search(query: string, type: 'track' | 'artist' | 'album', offset = 0, signal?: AbortSignal): Promise<CatalogPage> {
    signal?.throwIfAborted(); const references = new Map<string, MusicReference>();
    if (type === 'track') for (const playlist of this.playlists.playlists.values()) if (!playlist.temporary) for (const song of playlist.songs) if (`${song.title} ${song.artist ?? ''} ${song.metadata.album ?? ''}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))) references.set(song.libraryKey, { id: `local:${song.id}`, providerId: 'local', providerTrackId: song.id, title: song.title, artistName: song.artist ?? '', albumName: song.metadata.album ?? '', duration: song.duration, artworkUrl: null, spotifyUri: null, externalUrl: null, playbackCapability: 'local-file' });
    const start = Math.max(0, offset), tracks = [...references.values()]; return { tracks: tracks.slice(start, start + 10), entities: [], nextOffset: tracks.length > start + 10 ? start + 10 : null };
  }
  pause(): void { this.player.pause(); }
  async resume(): Promise<void> { await this.player.play(); }
}
