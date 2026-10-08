import { LocalAudioSourceHandler } from '../adapter/LocalFileAudioAdapter';
import type { AudioSourceHandler } from '../adapter/AudioSource';
import { BrowserStorageHandler, type StorageHandler } from '../../storage/StorageHandler';
import { WebAudioOutput, type AudioOutput } from '../bridge/AudioOutput';
export interface PlayerConfiguration { initialVolume: number; fadeDuration: number; boostFactor: number; }
export interface PlayerEnvironmentFactory {
  createSources(): AudioSourceHandler;
  createStorage(): StorageHandler;
  createOutput(): AudioOutput;
  createConfiguration(): PlayerConfiguration;
}
// The composition root requests a compatible browser-only product family.
export class WebPlayerFactory implements PlayerEnvironmentFactory {
  createSources(): AudioSourceHandler { return new LocalAudioSourceHandler(); }
  createStorage(): StorageHandler { return new BrowserStorageHandler(); }
  createOutput(): AudioOutput { return new WebAudioOutput(); }
  createConfiguration(): PlayerConfiguration { return { initialVolume: 0.65, fadeDuration: 1600, boostFactor: 1.35 }; }
}
