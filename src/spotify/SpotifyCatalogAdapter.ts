import type { CatalogEntity, CatalogPage, MusicCatalogProvider, MusicReference } from '../music/MusicProvider';
import { SpotifyError } from './SpotifyError';
import type { SpotifyApiClient } from './SpotifyApiClient';
export const spotifyId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z\d]{22}$/.test(id);
const text = (value: unknown): string => typeof value === 'string' ? value.slice(0, 300).trim() : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const entries = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export function artworkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && /(^|\.)(scdn\.co|spotifycdn\.com|spotifycdn\.net)$/.test(url.hostname) ? url.href : null; } catch { return null; }
}
export function normalizeSpotifyTrack(value: unknown, album?: unknown): MusicReference | null {
  const record = object(value), albumRecord = object(album ?? record.album), artists = entries(record.artists).map(item => text(object(item).name)).filter(Boolean);
  if (!spotifyId(record.id) || !text(record.name)) return null;
  const restricted = record.is_playable === false || record.is_local === true || !!object(record.restrictions).reason;
  return Object.freeze({ id: `spotify:${record.id}`, providerId: 'spotify', providerTrackId: record.id, title: text(record.name), artistName: artists.join(', '), albumName: text(albumRecord.name), duration: typeof record.duration_ms === 'number' && Number.isFinite(record.duration_ms) ? Math.max(0, record.duration_ms / 1000) : 0, artworkUrl: artworkUrl(object(entries(albumRecord.images)[0]).url), spotifyUri: `spotify:track:${record.id}`, externalUrl: `https://open.spotify.com/track/${record.id}`, playbackCapability: restricted ? 'unavailable' : 'spotify-premium' });
}
function normalizeEntity(value: unknown, type: 'artist' | 'album'): CatalogEntity | null {
  const record = object(value); if (!spotifyId(record.id) || !text(record.name)) return null;
  return Object.freeze({ id: record.id, type, name: text(record.name), artistName: entries(record.artists).map(item => text(object(item).name)).filter(Boolean).join(', '), artworkUrl: artworkUrl(object(entries(record.images)[0]).url), externalUrl: `https://open.spotify.com/${type}/${record.id}` });
}
function nextOffset(value: unknown, offset: number, limit: number, maximum = 1000): number | null { const page = object(value); return typeof page.total === 'number' && page.total > offset + limit && offset + limit <= maximum ? offset + limit : null; }
export class SpotifyCatalogAdapter implements MusicCatalogProvider {
  readonly providerId = 'spotify';
  constructor(private readonly api: SpotifyApiClient) {}
  async search(query: string, type: 'track' | 'artist' | 'album', offset = 0, signal?: AbortSignal): Promise<CatalogPage> {
    if (!['track', 'artist', 'album'].includes(type) || !Number.isInteger(offset) || offset < 0 || offset > 1000) throw new SpotifyError('response', 'Búsqueda o página inválida.');
    const trimmed = query.trim().slice(0, 200); if (!trimmed) return { tracks: [], entities: [], nextOffset: null };
    const data = await this.api.call<Record<string, unknown>>(`/search?${new URLSearchParams({ q: trimmed, type, limit: '10', offset: String(offset) })}`, 'GET', undefined, signal);
    const page = object(data[`${type}s`]), items = entries(page.items);
    const tracks = type === 'track' ? items.map(item => normalizeSpotifyTrack(item)).filter((item): item is MusicReference => !!item) : [];
    return { tracks: [...new Map(tracks.map(track => [track.id, track])).values()], entities: type === 'track' ? [] : items.map(item => normalizeEntity(item, type)).filter((item): item is CatalogEntity => !!item), nextOffset: nextOffset(page, offset, 10) };
  }
  async artistAlbums(id: string, offset = 0, signal?: AbortSignal): Promise<CatalogPage> {
    this.validate(id, offset); const page = await this.api.call<unknown>(`/artists/${id}/albums?limit=10&offset=${offset}`, 'GET', undefined, signal);
    return { tracks: [], entities: entries(object(page).items).map(item => normalizeEntity(item, 'album')).filter((item): item is CatalogEntity => !!item), nextOffset: nextOffset(page, offset, 10, 10000) };
  }
  async albumTracks(id: string, offset = 0, signal?: AbortSignal): Promise<CatalogPage> {
    this.validate(id, offset);
    const album = await this.api.call<unknown>(`/albums/${id}`, 'GET', undefined, signal), page = await this.api.call<unknown>(`/albums/${id}/tracks?limit=10&offset=${offset}`, 'GET', undefined, signal);
    return { tracks: entries(object(page).items).map(item => normalizeSpotifyTrack(item, album)).filter((item): item is MusicReference => !!item), entities: [], nextOffset: nextOffset(page, offset, 10, 10000) };
  }
  private validate(id: string, offset: number): void { if (!spotifyId(id) || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new SpotifyError('response', 'Referencia o página inválida.'); }
}
