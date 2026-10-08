export interface SongMetadata {
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly genres?: readonly string[];
  readonly tags?: readonly string[];
}
export function sanitizeMetadata(value: unknown): SongMetadata {
  if (!value || typeof value !== 'object') return Object.freeze({});
  const record = value as Record<string, unknown>;
  const clean = (input: unknown): string | undefined => typeof input === 'string' && input.trim() ? input.trim().slice(0, 300) : undefined;
  const strings = (input: unknown): readonly string[] => Object.freeze(Array.isArray(input) ? input.slice(0, 30).map(clean).filter((item): item is string => !!item) : []);
  return Object.freeze({ title: clean(record.title), artist: clean(record.artist), album: clean(record.album), genres: strings(record.genres), tags: strings(record.tags) });
}
