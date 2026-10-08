import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalRecommendationEngine, seededRandom } from '../src/radio/LocalRecommendationEngine';
import { LocalRadioService } from '../src/radio/LocalRadioService';
import { PlaylistService } from '../src/services/PlaylistService';
import { PlaylistEditor } from '../src/services/PlaylistEditor';
import { AudioPlayerService } from '../src/services/AudioPlayerService';
import { LocalMetadataReader } from '../src/services/LocalMetadataReader';
import { OfflineLibraryService, type LibrarySnapshot } from '../src/services/OfflineLibraryService';
import { LocalFileSongImporter } from '../src/patterns/factory/SongImporter';
import type { LocalRepository, RepositoryStore } from '../src/storage/IndexedDbRepository';
import { LocalFileAudioAdapter } from '../src/patterns/adapter/LocalFileAudioAdapter';
import { FakeOutput, source, song } from './helpers';
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
function setup(count = 6) {
  const library = new PlaylistService({ load: () => [], save: () => true }), output = new FakeOutput(), player = new AudioPlayerService(output, { initialVolume: .65, fadeDuration: 1000, boostFactor: 1.35 }), editor = new PlaylistEditor(library, player);
  for (let i = 0; i < count; i++) library.active.songs.addLast(song(`Song ${i}`));
  player.attach(library.active);
  return { library, output, player, editor, radio: new LocalRadioService(library, player, editor) };
}
class MemoryRepository implements LocalRepository {
  data = new Map<string, unknown>();
  async read<T>(store: RepositoryStore, key: string): Promise<T | undefined> { return this.data.get(store + key) as T | undefined; }
  async write(store: RepositoryStore, key: string, value: unknown): Promise<void> { this.data.set(store + key, value); }
  async remove(store: RepositoryStore, key: string): Promise<void> { this.data.delete(store + key); }
}
describe('Local recommendation engine', () => {
  it('reproduces selections with an identical seed and changes with another seed', () => {
    const { library } = setup(20), songs = [...library.active.songs], engine = new LocalRecommendationEngine();
    const choose = (seed: number) => engine.select(songs[0], songs, new Set(), 10, seededRandom(seed)).map(item => item.song.libraryKey);
    expect(choose(7)).toEqual(choose(7)); expect(choose(7)).not.toEqual(choose(99)); expect(new Set(choose(7)).size).toBe(10);
  });
  it('scores only available metadata and explains fallback without inventing similarity', () => {
    const seed = song('Sunrise'), related = song('Sunrise again'), unrelated = song('Elsewhere');
    seed.applyMetadata({ artist: 'Álvaro', album: 'Days', genres: ['Jazz'], tags: ['Piano'] }); related.applyMetadata({ artist: 'alvaro', album: 'Days', genres: ['jazz'], tags: ['piano'] });
    const engine = new LocalRecommendationEngine(); expect(engine.explain(seed, related).score).toBe(15); expect(engine.explain(seed, related).reasons).toHaveLength(5); expect(engine.explain(seed, unrelated).score).toBe(0);
    expect(engine.select(seed, [unrelated], new Set(), 1, seededRandom(1))[0].reasons).toEqual(['Selección aleatoria de tu biblioteca']);
    expect(new LocalRecommendationEngine({ artist: 0 }).explain(seed, related).score).toBe(10); expect(() => new LocalRecommendationEngine({ artist: NaN })).toThrow();
  });
  it('excludes seed, cloned files and previously included entries', () => {
    const seed = song('Seed'), a = song('A'), b = song('B'), engine = new LocalRecommendationEngine(); const clone = a.clone();
    expect(engine.select(seed, [seed.clone(), a, clone, b], new Set([b.libraryKey]), 50, seededRandom(1)).map(item => item.song)).toEqual([a]); clone.dispose();
  });
  it('bounds work and rejects invalid randomness or limits', () => {
    const seed = song('Seed'), other = song('Other'), engine = new LocalRecommendationEngine();
    expect(() => engine.select(seed, [other], new Set(), 101, seededRandom(1))).toThrow(); expect(() => engine.select(seed, [other], new Set(), 1, () => 1)).toThrow(); expect(engine.select(seed, [], new Set(), 5, seededRandom(1))).toEqual([]);
  });
});
describe('Local radio and linked playback', () => {
  it('retains seed first, creates independent nodes and leaves original lists untouched', () => {
    const { library, radio } = setup(), original = library.active, snapshot = original.songs.readSnapshot(); const selection = radio.start(original.songs.head!.song, 5, 3);
    expect(selection.temporary).toBe(true); expect(selection.songs.getSize()).toBe(4); expect(selection.songs.head).not.toBe(original.songs.head); expect(selection.songs.head!.song.id).not.toBe(original.songs.head!.song.id); expect(selection.songs.head!.song.libraryKey).toBe(original.songs.head!.song.libraryKey); expect(original.songs.readSnapshot()).toEqual(snapshot); selection.songs.assertIntegrity(); radio.dispose();
  });
  it('refills near the end without duplicates, consumes the finite library and stops normally', async () => {
    const { library, radio, player, output } = setup(8); const selection = radio.start(library.active.songs.head!.song, 1, 1);
    await player.play(); expect(selection.songs.getSize()).toBeGreaterThan(2);
    for (let i = 0; i < 7; i++) await player.next();
    expect(selection.songs.getSize()).toBe(8); expect(new Set([...selection.songs].map(item => item.libraryKey)).size).toBe(8); expect(player.canNext).toBe(false);
    const changed = vi.fn(); radio.addEventListener('change', changed); radio.fillIfNeeded(); radio.fillIfNeeded(); expect(changed).not.toHaveBeenCalled(); expect(radio.status).toContain('No encontramos más'); output.element.dispatchEvent(new Event('ended')); await Promise.resolve(); expect(player.state).toBe('paused'); selection.songs.assertIntegrity(); radio.dispose();
  });
  it('honors disabled continuous playback and queue priority over repeat-one', async () => {
    const { library, radio, player } = setup(6), original = library.active, seed = original.songs.head!.song, queued = original.songs.getAt(4);
    radio.configure(false, false); const selection = radio.start(seed, 1, 1); player.setMode('one'); player.queue.add(queued, original.id, original.name); await player.play(); await player.next(); expect(player.song!.libraryKey).toBe(queued.libraryKey); expect(selection.songs.getSize()).toBe(2); await player.previous(); expect(player.song!.libraryKey).toBe(seed.libraryKey); radio.dispose();
  });
  it('saves with Prototype and supports Undo/Redo after the temporary session ends', () => {
    const { library, radio, editor } = setup(), original = library.active, selection = radio.start(original.songs.head!.song, 1, 4), order = [...selection.songs].map(item => item.libraryKey), saved = radio.save('My saved radio');
    expect(saved.id).not.toBe(selection.id); expect(saved.temporary).toBe(false); expect([...saved.songs].map(item => item.libraryKey)).toEqual(order); expect(saved.songs.head).not.toBe(selection.songs.head); radio.end(); expect(saved.songs.getSize()).toBe(5); editor.undo(); expect(library.playlists.has(saved.id)).toBe(false); editor.redo(); expect(library.playlists.has(saved.id)).toBe(true); saved.songs.assertIntegrity();
  });
  it('drops temporary commands while retaining earlier permanent edits and releases sources', () => {
    const { library, radio, editor } = setup(), original = library.active; editor.rename(original, 'Renamed'); const seed = original.songs.head!.song, selection = radio.start(seed, 1, 2); editor.remove(selection, selection.songs.tail!.song.id); editor.undo(); editor.redo(); radio.end(); expect(editor.history.canRedo).toBe(false); editor.undo(); expect(original.name).toBe('Favoritas'); expect(library.playlists.has(selection.id)).toBe(false); expect(selection.songs.isEmpty()).toBe(true); original.songs.assertIntegrity();
  });
  it('regenerates reproducibly and allows another radio from the current temporary song', () => {
    const { library, radio } = setup(10); radio.start(library.active.songs.head!.song, 42, 5); const initial = [...radio.playlist!.songs].map(item => item.libraryKey); radio.regenerate(); expect([...radio.playlist!.songs].map(item => item.libraryKey)).toEqual(initial); const another = radio.playlist!.songs.getAt(2); radio.start(another, 9, 3); expect(radio.seed!.libraryKey).toBe(another.libraryKey); expect(library.playlists.size).toBe(2); radio.dispose();
  });
  it('supports manual additions and removal without resurrecting a duplicate', () => {
    const { library, radio, editor } = setup(7), original = library.active; const selection = radio.start(original.songs.head!.song, 1, 1); const chosen = [...original.songs].find(item => ![...selection.songs].some(entry => entry.libraryKey === item.libraryKey))!;
    expect(radio.add(chosen)).toBe(true); expect(radio.add(chosen)).toBe(false); editor.remove(selection, selection.songs.tail!.song.id); radio.fillIfNeeded(); expect([...selection.songs].filter(item => item.libraryKey === chosen.libraryKey)).toHaveLength(0); radio.dispose();
  });
  it('persists configuration, previews alone when disabled and automatically generates when enabled', async () => {
    const { library, radio } = setup(); const seed = library.active.songs.head!.song; await radio.preview(seed); expect(radio.isRadio).toBe(false); expect(radio.playlist!.songs.getSize()).toBe(1); radio.configure(true, false); await radio.preview(seed); expect(radio.isRadio).toBe(true); expect(radio.playlist!.songs.getSize()).toBe(6); expect(JSON.parse(localStorage.getItem('sonaris.radio')!).automatic).toBe(true); radio.dispose();
  });
  it('handles an empty library, singleton seed and invalid configuration without mutating playback', () => {
    const { radio, library } = setup(0); expect([...radio.songs()]).toEqual([]); expect(radio.find('missing')).toBeNull(); const seed = song(); radio.start(seed); expect(radio.playlist!.songs.getSize()).toBe(1); expect(radio.status).toContain('No encontramos más'); const id = radio.playlist!.id; expect(() => radio.start(seed, -1)).toThrow(); expect(radio.playlist!.id).toBe(id); radio.end(); expect(library.playlists.size).toBe(1);
  });
  it('retains a permanent fallback when its original playlist is deleted during a radio', () => {
    const { radio, library, editor } = setup(), original = library.active; radio.start(original.songs.head!.song); editor.delete(original); radio.end(); expect(library.active).toBeDefined(); expect(library.active.temporary).toBe(false); expect(library.playlists.size).toBe(1);
  });
  it('releases the temporary clone without revoking the source owned by the original or saved copy', () => {
    URL.createObjectURL ??= vi.fn(); URL.revokeObjectURL ??= vi.fn();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:owned'), revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { library, radio, editor, player } = setup(0); const file = new File(['wav'], 'Owned.wav', { type: 'audio/wav' }), importer = new LocalFileSongImporter({ create: item => new LocalFileAudioAdapter(item) }); const seed = importer.import(file); library.active.songs.addLast(seed); radio.start(seed); const saved = radio.save('Saved'); radio.end(); expect(revoke).not.toHaveBeenCalled(); player.dispose(); editor.history.clear(); library.dispose(); expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned'); expect(saved.songs.isEmpty()).toBe(true); create.mockRestore(); revoke.mockRestore();
  });
  it('omits temporary radio from both persistence stores and restores saved metadata and file identity', async () => {
    const { library, radio } = setup(3), repository = new MemoryRepository(), importer = new LocalFileSongImporter({ create: () => source() }), offline = new OfflineLibraryService(repository, library, importer), original = library.active, seed = original.songs.head!.song;
    seed.applyMetadata({ title: 'Tagged title', artist: 'Artist', genres: ['Jazz'] }); await offline.setSaved([seed], true); radio.start(seed); await offline.persistMetadata(); const snapshot = await repository.read<LibrarySnapshot>('library', 'current'); expect(snapshot!.playlists).toHaveLength(1); expect(snapshot!.activeId).toBe(original.id);
    const saved = radio.save('Saved radio'); await offline.savePlaylist(saved); radio.end(); const restored = new PlaylistService({ load: () => [], save: () => true }); await new OfflineLibraryService(repository, restored, importer).restore(); const recovered = restored.playlists.get(saved.id)!.songs.head!.song; expect(recovered.metadata.artist).toBe('Artist'); expect(recovered.libraryKey).toBe(seed.libraryKey); expect(recovered.title).toBe('Tagged title'); expect(recovered.file.lastModified).toBe(seed.file.lastModified);
  });
});
describe('Bounded local metadata parsing', () => {
  it('extracts ID3v2.3 title, artist, album and genre while rejecting truncated tags', () => {
    const frames = Object.entries({ TIT2: 'Tagged title', TPE1: 'Tagged artist', TALB: 'Tagged album', TCON: 'Jazz' }).map(([id, value]) => { const encoded = new TextEncoder().encode(value), frame = new Uint8Array(11 + encoded.length); frame.set(new TextEncoder().encode(id)); new DataView(frame.buffer).setUint32(4, encoded.length + 1); frame[10] = 3; frame.set(encoded, 11); return frame; });
    const size = frames.reduce((sum, frame) => sum + frame.length, 0), bytes = new Uint8Array(size + 10); bytes.set([73, 68, 51, 3, 0, 0, 0, 0, size >> 7, size & 127]); let offset = 10; for (const frame of frames) { bytes.set(frame, offset); offset += frame.length; }
    const reader = new LocalMetadataReader(); expect(reader.parse(bytes)).toMatchObject({ title: 'Tagged title', artist: 'Tagged artist', album: 'Tagged album', genres: ['Jazz'] }); bytes[3] = 4; expect(reader.parse(bytes).artist).toBe('Tagged artist'); bytes[5] = 0x80; expect(reader.parse(bytes)).toEqual({}); bytes[5] = 0; expect(reader.parse(bytes.slice(0, 14)).artist).toBeUndefined(); expect(reader.parse(new Uint8Array([1, 2, 3]))).toEqual({});
  });
  it('extracts WAV INFO and safely ignores malicious chunk sizes', () => {
    const value = new TextEncoder().encode('Local artist\0'), bytes = new Uint8Array(32 + value.length + value.length % 2), view = new DataView(bytes.buffer); bytes.set(new TextEncoder().encode('RIFF')); bytes.set(new TextEncoder().encode('WAVE'), 8); bytes.set(new TextEncoder().encode('LIST'), 12); view.setUint32(16, bytes.length - 20, true); bytes.set(new TextEncoder().encode('INFO'), 20); bytes.set(new TextEncoder().encode('IART'), 24); view.setUint32(28, value.length, true); bytes.set(value, 32); const reader = new LocalMetadataReader(); expect(reader.parse(bytes).artist).toBe('Local artist'); view.setUint32(16, 0xffffffff, true); expect(reader.parse(bytes).artist).toBeUndefined();
  });
  it('extracts FLAC Vorbis comments without reading audio frames', () => {
    const comment = new TextEncoder().encode('GENRE=Ambient'), size = 12 + comment.length, bytes = new Uint8Array(8 + size), view = new DataView(bytes.buffer); bytes.set(new TextEncoder().encode('fLaC')); bytes[4] = 0x84; bytes[7] = size; view.setUint32(8, 0, true); view.setUint32(12, 1, true); view.setUint32(16, comment.length, true); bytes.set(comment, 20); expect(new LocalMetadataReader().parse(bytes).genres).toEqual(['Ambient']);
  });
});
