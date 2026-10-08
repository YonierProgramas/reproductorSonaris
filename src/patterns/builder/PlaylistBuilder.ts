import { Playlist, type RepeatMode } from '../../models/Playlist';
export class PlaylistBuilder {
  private id: string | undefined;
  withId(id: string): this { this.id = id; return this; }
  private name = ''; private description = ''; private repeatMode: RepeatMode = 'normal';
  withName(name: string): this { this.name = name; return this; }
  withDescription(description: string): this { this.description = description; return this; }
  withRepeatMode(mode: RepeatMode): this { this.repeatMode = mode; return this; }
  build(): Playlist { return new Playlist(this.name, this.description, this.repeatMode, this.id); }
}
