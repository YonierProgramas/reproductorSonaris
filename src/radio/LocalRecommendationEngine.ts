import type { Song } from '../models/Song';
export interface SimilarityWeights { artist: number; album: number; genre: number; tag: number; title: number; diversity: number; }
export interface Recommendation { song: Song; score: number; reasons: readonly string[]; }
export const defaultWeights: Readonly<SimilarityWeights> = Object.freeze({ artist: 5, album: 3, genre: 4, tag: 2, title: 1, diversity: 2 });
const normalized = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
const words = (value: string): Set<string> => new Set(normalized(value).split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2));
const intersects = (a: readonly string[], b: readonly string[]): boolean => a.some(item => b.some(other => normalized(item) === normalized(other)));
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}
export class LocalRecommendationEngine {
  readonly weights: Readonly<SimilarityWeights>;
  constructor(weights: Partial<SimilarityWeights> = {}) {
    this.weights = Object.freeze({ ...defaultWeights, ...weights });
    if (Object.values(this.weights).some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Invalid similarity weight');
  }
  explain(seed: Song, song: Song): Recommendation {
    const reasons: string[] = []; let score = 0;
    if (seed.artist && song.artist && normalized(seed.artist) === normalized(song.artist)) { score += this.weights.artist; reasons.push('Mismo artista'); }
    if (seed.metadata.album && song.metadata.album && normalized(seed.metadata.album) === normalized(song.metadata.album)) { score += this.weights.album; reasons.push('Mismo álbum'); }
    if (intersects(seed.metadata.genres ?? [], song.metadata.genres ?? [])) { score += this.weights.genre; reasons.push('Género compartido'); }
    if (intersects(seed.metadata.tags ?? [], song.metadata.tags ?? [])) { score += this.weights.tag; reasons.push('Etiqueta compartida'); }
    const seedWords = words(seed.title), songWords = words(song.title);
    if ([...seedWords].some(word => songWords.has(word))) { score += this.weights.title; reasons.push('Palabra compartida en el título'); }
    return { song, score, reasons: Object.freeze(reasons) };
  }
  select(seed: Song, songs: Iterable<Song>, excluded: ReadonlySet<string>, limit: number, random: () => number): Recommendation[] {
    if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new Error('Invalid recommendation limit');
    const unique = new Map<string, Recommendation>();
    for (const song of songs) if (song.libraryKey !== seed.libraryKey && !excluded.has(song.libraryKey) && !unique.has(song.libraryKey)) unique.set(song.libraryKey, this.explain(seed, song));
    // Arrays are bounded working buffers for ranking; playback storage remains a linked list.
    const candidates = [...unique.values()], selected: Recommendation[] = [], artists = new Map<string, number>();
    while (selected.length < limit && candidates.length) {
      const weights = candidates.map(item => (1 + item.score) / (1 + this.weights.diversity * (artists.get(normalized(item.song.artist ?? '')) ?? 0)));
      const sample = random(); if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('Invalid random sample');
      let remaining = sample * weights.reduce((sum, weight) => sum + weight, 0), index = 0;
      while (index < weights.length - 1 && (remaining -= weights[index]) >= 0) index++;
      const recommendation = candidates.splice(index, 1)[0];
      if (!recommendation.reasons.length) recommendation.reasons = Object.freeze(['Selección aleatoria de tu biblioteca']);
      selected.push(recommendation); const artist = normalized(recommendation.song.artist ?? '');
      // Missing artist metadata is not a shared artist and receives no diversity penalty.
      if (artist) artists.set(artist, (artists.get(artist) ?? 0) + 1);
    }
    return selected;
  }
}
