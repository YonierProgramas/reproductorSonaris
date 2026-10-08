import './styles/main.css';
import { WebPlayerFactory,type PlayerEnvironmentFactory } from './patterns/factory/PlayerEnvironmentFactory';
import { LocalFileSongImporter,type SongImporter } from './patterns/factory/SongImporter';
import { WebAudioOutput } from './patterns/bridge/AudioOutput';
import { PlaylistService } from './services/PlaylistService';
import { AudioPlayerService } from './services/AudioPlayerService';
import { PlaylistEditor } from './services/PlaylistEditor';
import { SleepTimerService } from './services/SleepTimerService';
import { StatisticsService } from './services/StatisticsService';
import { OfflineLibraryService } from './services/OfflineLibraryService';
import { KeyboardShortcutService } from './services/KeyboardShortcutService';
import { IndexedDbRepository } from './storage/IndexedDbRepository';
import { PwaService } from './offline/PwaService';
import { LocalRadioService } from './radio/LocalRadioService';
import { LocalRadioView } from './ui/LocalRadioView';
import { SpotifyIntegrationFactory } from './spotify/SpotifyIntegrationFactory';
import { LocalMusicProvider } from './music/LocalMusicProvider';
import { PlaybackCoordinator } from './music/PlaybackCoordinator';
import { SpotifyView } from './ui/SpotifyView';
import { AppView } from './ui/AppView';
import { AdvancedView } from './ui/AdvancedView';
async function bootstrap():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app')!;root.innerHTML='<p class="loading-library" role="status">Cargando tu biblioteca local…</p>';
  const environment:PlayerEnvironmentFactory=new WebPlayerFactory();
  const playlists=new PlaylistService(environment.createStorage());const output=environment.createOutput();const player=new AudioPlayerService(output,environment.createConfiguration());
  const importer:SongImporter=new LocalFileSongImporter(environment.createSources());const repository=new IndexedDbRepository();
  const offline=new OfflineLibraryService(repository,playlists,importer);const statistics=new StatisticsService(repository,player);const messages:string[]=[];
  try{await offline.restore();}catch{messages.push('No se pudo recuperar la biblioteca local. Puedes seleccionar archivos y seguir escuchando.');}
  try{await statistics.restore();}catch{messages.push('Las estadísticas locales no están disponibles en este navegador.');}
  player.attach(playlists.active);const editor=new PlaylistEditor(playlists,player);const timer=new SleepTimerService(player);const pwa=new PwaService();
  const app = new AppView(root,playlists,player,importer,editor);
  const radio = new LocalRadioService(playlists,player,editor);
  radio.addEventListener('change', () => app.refresh());
  const radioView = new LocalRadioView(root.querySelector<HTMLElement>('#local-discovery')!,radio,player,app);
  if(!(output instanceof WebAudioOutput))throw new Error('Web output required');
  const advanced=new AdvancedView(root.querySelector<HTMLElement>('#advanced-tools')!,playlists,player,output.processing,statistics,offline,timer,pwa);
  const spotify = new SpotifyIntegrationFactory().create({ clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '', redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? '' });
  const coordinator = new PlaybackCoordinator(player,spotify.playback,timer,new LocalMusicProvider(playlists,player));
  const spotifyView = new SpotifyView(root.querySelector<HTMLElement>('#spotify-tools')!,spotify.auth,spotify.catalog,spotify.playback,spotify.collection,coordinator);
  spotify.auth.addEventListener('change', () => { if(spotify.auth.connected) void spotify.playback.initialize().catch(()=>{}); });
  const keyboard=new KeyboardShortcutService(player,editor,()=>coordinator.source==='local');
  player.addEventListener('change',()=>spotifyView.refreshSource());
  void spotify.auth.handleCallback().catch(()=>advanced.notify('No fue posible procesar la autorización de Spotify. Mi música sigue disponible.'));
  root.addEventListener('librarychange',()=>{advanced.refresh();void offline.persistMetadata().catch(()=>advanced.notify(offline.status));});
  player.addEventListener('change',()=>{ if(player.song)root.querySelector('#now-title')?.setAttribute('title',player.song.title); });
  if(messages.length)advanced.notify(messages.join(' '));
  if(import.meta.env.PROD)void pwa.prepare().catch(()=>advanced.notify('No se pudieron preparar los recursos sin conexión. La aplicación sigue disponible en línea.'));
  // Flush queued local writes before releasing playback/source ownership. No music is uploaded.
  window.addEventListener('pagehide',event=>{
    void offline.persistMetadata().catch(()=>{});void statistics.flush().catch(()=>{});
    if(!event.persisted){spotifyView.dispose();coordinator.dispose();spotify.playback.dispose();spotify.auth.dispose();spotify.collection.clear();radioView.dispose();radio.dispose();keyboard.dispose();advanced.dispose();timer.dispose();statistics.dispose();player.dispose();editor.history.clear();playlists.dispose();}
  });
}
void bootstrap().catch(error=>{console.error('Sonaris initialization failed',error);document.querySelector<HTMLElement>('#app')!.innerHTML='<p role="alert">No se pudo iniciar Sonaris. Recarga la página o comprueba la compatibilidad del navegador.</p>';});
