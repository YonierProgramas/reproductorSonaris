import { sanitizeMetadata, type SongMetadata } from '../models/SongMetadata';
const maximumBytes = 2 * 1024 * 1024;
const ascii = (bytes: Uint8Array, start: number, length: number): string => String.fromCharCode(...bytes.subarray(start, start + length));
const syncSafe = (bytes: Uint8Array, offset: number): number => ((bytes[offset] & 127) << 21) | ((bytes[offset + 1] & 127) << 14) | ((bytes[offset + 2] & 127) << 7) | (bytes[offset + 3] & 127);
export class LocalMetadataReader {
  async read(file: File): Promise<SongMetadata> {
    try { if (typeof file.slice(0, 1).arrayBuffer !== 'function') return {}; return this.parse(new Uint8Array(await file.slice(0, maximumBytes).arrayBuffer())); } catch { return {}; }
  }
  parse(bytes: Uint8Array): SongMetadata {
    try {
      if (ascii(bytes, 0, 3) === 'ID3') return this.id3(bytes);
      if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return this.wave(bytes);
      if (ascii(bytes, 0, 4) === 'fLaC') return this.flac(bytes);
    } catch { /* Invalid or unsupported tags leave file playback intact. */ }
    return {};
  }
  private id3(bytes: Uint8Array): SongMetadata {
    if (bytes.length < 10 || ![3, 4].includes(bytes[3]) || bytes[5] & 0x80) return {};
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), version = bytes[3];
    const end = Math.min(bytes.length, 10 + syncSafe(bytes, 6)); let offset = 10;
    if (bytes[5] & 0x40) { if (offset + 4 > end) return {}; const size = version === 4 ? syncSafe(bytes, offset) : view.getUint32(offset); offset += size + (version === 3 ? 4 : 0); }
    const values: Record<string, string> = {};
    const names: Record<string, string> = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TCON: 'genre' };
    while (offset + 10 <= end) {
      const id = ascii(bytes, offset, 4), size = version === 4 ? syncSafe(bytes, offset + 4) : view.getUint32(offset + 4);
      if (!/^[A-Z0-9]{4}$/.test(id) || size < 1 || offset + 10 + size > end) break;
      const encoding = bytes[offset + 10], data = bytes.subarray(offset + 11, offset + 10 + size);
      // Compressed/encrypted/unsynchronized frames are deliberately not decoded.
      if (names[id] && !bytes[offset + 9] && encoding <= 3) {
        const decoder = new TextDecoder(encoding === 0 ? 'iso-8859-1' : encoding === 2 ? 'utf-16be' : encoding === 1 ? (data[0] === 0xfe && data[1] === 0xff ? 'utf-16be' : 'utf-16le') : 'utf-8');
        values[names[id]] = decoder.decode(data).replace(/\u0000/g, ' ').replace(/^\uFEFF/, '').trim();
      }
      offset += 10 + size;
    }
    return sanitizeMetadata({ ...values, genres: values.genre ? [values.genre] : [] });
  }
  private wave(bytes: Uint8Array): SongMetadata {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), values: Record<string, string> = {};
    const names: Record<string, string> = { INAM: 'title', IART: 'artist', IPRD: 'album', IGNR: 'genre' };
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const id = ascii(bytes, offset, 4), size = view.getUint32(offset + 4, true), end = offset + 8 + size;
      if (end > bytes.length) break;
      if (id === 'LIST' && ascii(bytes, offset + 8, 4) === 'INFO') {
        let entry = offset + 12;
        while (entry + 8 <= end) { const tag = ascii(bytes, entry, 4), length = view.getUint32(entry + 4, true); if (entry + 8 + length > end) break; if (names[tag]) values[names[tag]] = new TextDecoder().decode(bytes.subarray(entry + 8, entry + 8 + length)).replace(/\u0000/g, '').trim(); entry += 8 + length + (length % 2); }
      }
      offset = end + (size % 2);
    }
    return sanitizeMetadata({ ...values, genres: values.genre ? [values.genre] : [] });
  }
  private flac(bytes: Uint8Array): SongMetadata {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = 4;
    while (offset + 4 <= bytes.length) {
      const type = bytes[offset] & 127, last = !!(bytes[offset] & 128), size = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]; offset += 4;
      const end = offset + size; if (end > bytes.length) break;
      if (type === 4 && size >= 8) {
        const names: Record<string, string> = { TITLE: 'title', ARTIST: 'artist', ALBUM: 'album' }, values: Record<string, string> = {}, genres: string[] = [];
        const vendorLength = view.getUint32(offset, true); let position = offset + 4 + vendorLength; if (position + 4 > end) return {};
        const count = Math.min(view.getUint32(position, true), 1000); position += 4;
        for (let i = 0; i < count && position + 4 <= end; i++) { const length = view.getUint32(position, true); position += 4; if (position + length > end) break; const item = new TextDecoder().decode(bytes.subarray(position, position + length)), separator = item.indexOf('='); const key = item.slice(0, separator).toUpperCase(), value = item.slice(separator + 1); if (separator >= 0) { if (names[key]) values[names[key]] = value; if (key === 'GENRE') genres.push(value); } position += length; }
        return sanitizeMetadata({ ...values, genres });
      }
      offset = end; if (last) break;
    }
    return {};
  }
}
