import { SpotifyAuthService, type SpotifyConfiguration } from './SpotifyAuthService';
import { SpotifyApiClient } from './SpotifyApiClient';
import { SpotifyCatalogAdapter } from './SpotifyCatalogAdapter';
import { SpotifyPlaybackAdapter } from './SpotifyPlaybackAdapter';
import { SpotifyReferenceCollection } from './SpotifyReferenceCollection';
export class SpotifyIntegrationFactory {
  create(configuration: SpotifyConfiguration) {
    const auth = new SpotifyAuthService(configuration), api = new SpotifyApiClient(auth);
    return { auth, catalog: new SpotifyCatalogAdapter(api), playback: new SpotifyPlaybackAdapter(auth, api), collection: new SpotifyReferenceCollection() };
  }
}
