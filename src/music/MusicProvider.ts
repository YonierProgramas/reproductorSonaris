export type MusicSourceId = 'local' | 'spotify';
export interface MusicReference {
  readonly id: string; readonly providerId: MusicSourceId; readonly providerTrackId: string;
  readonly title: string; readonly artistName: string; readonly albumName: string;
  readonly duration: number; readonly artworkUrl: string | null; readonly spotifyUri: string | null;
  readonly externalUrl: string | null; readonly playbackCapability: 'local-file' | 'spotify-premium' | 'unavailable';
}
export interface CatalogEntity { readonly id: string; readonly type: 'artist' | 'album'; readonly name: string; readonly artistName: string; readonly artworkUrl: string | null; readonly externalUrl: string; }
export interface CatalogPage { tracks: MusicReference[]; entities: CatalogEntity[]; nextOffset: number | null; }
export interface MusicCatalogProvider { readonly providerId: MusicSourceId; search(query: string, type: 'track' | 'artist' | 'album', offset?: number, signal?: AbortSignal): Promise<CatalogPage>; }
export interface MusicPlaybackProvider { readonly providerId: MusicSourceId; pause(): void | Promise<void>; resume(): Promise<void>; }
