import type { SpotifyAuthService } from '../spotify/SpotifyAuthService';
import type { SpotifyCatalogAdapter } from '../spotify/SpotifyCatalogAdapter';
import type { SpotifyPlaybackAdapter } from '../spotify/SpotifyPlaybackAdapter';
import type { SpotifyReferenceCollection } from '../spotify/SpotifyReferenceCollection';
import type { PlaybackCoordinator } from '../music/PlaybackCoordinator';
import type { MusicReference, CatalogEntity, CatalogPage } from '../music/MusicProvider';
import { errorMessage, SpotifyError } from '../spotify/SpotifyError';
import { artworkUrl } from '../spotify/SpotifyCatalogAdapter';
import spotifyLogo from '../assets/spotify-logo.svg';
import { escapeHtml, formatTime } from './formatters';
const spotifyMark = `<img src="${spotifyLogo}" class="spotify-wordmark" alt="Spotify">`;
export class SpotifyView {
  private currentPage: CatalogPage = { tracks: [], entities: [], nextOffset: null };
  private offset = 0;
  private collectionPage = 0;
  private query = '';
  private browse: CatalogEntity | null = null;
  private busy = false;
  private searchRevision = 0;
  private controller: AbortController | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private renderedTrack = 'initial';
  private readonly authChanged = () => {
    if (!this.auth.connected) { this.browse = null; this.offset = 0; this.query = ''; this.get<HTMLInputElement>('spotify-query').value = ''; this.cancelSearch(); this.currentPage = { tracks: [], entities: [], nextOffset: null }; this.collection.clear(); this.get('spotify-results').innerHTML = ''; this.get('spotify-message').textContent = ''; this.get('spotify-attribution').innerHTML = '<a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer">Contenido proporcionado por Spotify</a>'; this.get('spotify-page').textContent = ''; }
    this.renderAuth();
  };
  private readonly playbackChanged = () => this.renderPlayback();
  private readonly collectionChanged = () => this.renderCollection();
  private readonly sourceChanged = () => this.renderSource();
  private readonly localChanged = () => this.renderSource();
  constructor(private readonly container: HTMLElement, private readonly auth: SpotifyAuthService, private readonly catalog: SpotifyCatalogAdapter, private readonly playback: SpotifyPlaybackAdapter, private readonly collection: SpotifyReferenceCollection, private readonly coordinator: PlaybackCoordinator) {
    container.innerHTML = `<section class="spotify-workspace" aria-labelledby="spotify-title"><div class="spotify-heading"><div><span class="eyebrow">DOS ESPACIOS, UNA ESCUCHA A LA VEZ</span><h2 id="spotify-title">Mi música y Spotify</h2><p>Tu biblioteca personal sigue disponible sin iniciar sesión.</p></div><span class="source-badge" id="active-source">Mi música</span></div><div class="source-controls"><button class="button primary" data-spotify-action="local">Volver a Mi música</button><button class="quiet-button" data-spotify-action="show">Explorar Spotify</button></div><div id="spotify-panel" hidden><div class="spotify-auth"><h3>Conectar Spotify</h3><p id="spotify-auth-status" role="status" aria-live="polite"></p><p id="spotify-user"></p><p class="feature-note">Antes de conectar, conserva tus archivos desde Sin conexión: la autorización abre otra página y los archivos no guardados no sobreviven a esa navegación. La sesión Spotify solo dura mientras esta página siga abierta.</p><button class="button spotify-connect" id="spotify-connect" data-spotify-action="connect">Conectar con Spotify</button><button class="quiet-button" id="spotify-disconnect" data-spotify-action="disconnect" hidden>Desconectar Spotify</button><button class="quiet-button" id="spotify-activate" data-spotify-action="activate" hidden>Activar reproductor Spotify</button><p id="spotify-config" class="feature-note"></p></div><div class="spotify-search-controls"><label for="spotify-query">Explorar Spotify<input id="spotify-query" type="search" maxlength="200" placeholder="Canción, artista o álbum…" disabled></label><label for="spotify-kind">Buscar<select id="spotify-kind" disabled><option value="track">Canciones</option><option value="artist">Artistas</option><option value="album">Álbumes</option></select></label><button class="quiet-button" id="spotify-search-button" data-spotify-action="search" disabled>Buscar en Spotify</button><button class="quiet-button" id="spotify-back" data-spotify-action="back" hidden>Volver a la búsqueda</button></div><p id="spotify-message" class="spotify-message" role="status" aria-live="polite"></p><div id="spotify-results"></div><div class="spotify-pagination"><button class="quiet-button" id="spotify-previous-page" data-spotify-action="previous-page" disabled>Página anterior de Spotify</button><span id="spotify-page"></span><button class="quiet-button" id="spotify-next-page" data-spotify-action="next-page" disabled>Página siguiente de Spotify</button></div><section class="spotify-player" aria-label="Reproductor oficial de Spotify"><div id="spotify-now"></div><p id="spotify-playback-status" role="status"></p><div class="spotify-transport"><button class="quiet-button" id="spotify-previous" data-spotify-action="previous" disabled>Anterior en Spotify</button><button class="button spotify-connect" id="spotify-toggle" data-spotify-action="toggle" disabled>Reanudar Spotify</button><button class="quiet-button" id="spotify-next" data-spotify-action="next" disabled>Siguiente en Spotify</button></div><label for="spotify-progress">Progreso Spotify<input id="spotify-progress" type="range" min="0" max="1000" value="0" disabled></label><div class="spotify-times"><span id="spotify-time">00:00</span><span id="spotify-duration">00:00</span></div><label for="spotify-volume">Volumen Spotify<input id="spotify-volume" type="range" min="0" max="100" value="65" disabled></label><p class="feature-note">Spotify usa su reproductor protegido. Ecualizador, visualizador, fade, refuerzo, estadísticas, temporizador, radio y almacenamiento offline de Sonaris se aplican a Mi música. Sus colas y colecciones están separadas.</p></section><section class="spotify-collection" aria-labelledby="spotify-collection-title"><h3 id="spotify-collection-title">Referencias Spotify de esta sesión</h3><p class="feature-note">Lista doble independiente, hasta 100 referencias. Se borra al desconectar o recargar. No sincroniza playlists remotas ni guarda audio.</p><div id="spotify-collection"></div><div class="spotify-pagination"><button class="quiet-button" id="spotify-collection-previous" data-spotify-action="collection-previous">Referencias anteriores</button><span id="spotify-collection-page"></span><button class="quiet-button" id="spotify-collection-next" data-spotify-action="collection-next">Más referencias</button></div></section><p class="spotify-attribution" id="spotify-attribution"><a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer">Contenido proporcionado por Spotify</a></p></div></section>`;
    this.bind(); auth.addEventListener('change', this.authChanged); playback.addEventListener('change', this.playbackChanged); collection.addEventListener('change', this.collectionChanged); coordinator.addEventListener('change', this.sourceChanged);
    container.closest('#app')?.addEventListener('librarychange', this.localChanged); this.renderAuth(); this.renderPlayback(); this.renderCollection(); this.renderSource();
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.container.querySelector<T>(`#${id}`)!; }
  private bind(): void {
    this.container.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-spotify-action]'); if (!button || button.disabled) return; void this.action(button.dataset.spotifyAction!, button.dataset.id).catch(error => this.message(errorMessage(error))); });
    this.get<HTMLInputElement>('spotify-query').addEventListener('input', () => { this.cancelSearch(); this.debounce = setTimeout(() => { this.query = this.get<HTMLInputElement>('spotify-query').value; this.browse = null; this.offset = 0; void this.search().catch(error => this.message(errorMessage(error))); }, 350); });
    this.get<HTMLSelectElement>('spotify-kind').addEventListener('change', () => { this.browse = null; this.offset = 0; void this.search().catch(error => this.message(errorMessage(error))); });
    this.get<HTMLInputElement>('spotify-progress').addEventListener('change', () => { void this.playback.seek(Number(this.get<HTMLInputElement>('spotify-progress').value) / 1000 * this.playback.duration).catch(error => this.message(errorMessage(error))); });
    this.get<HTMLInputElement>('spotify-volume').addEventListener('change', () => { void this.playback.setVolume(Number(this.get<HTMLInputElement>('spotify-volume').value) / 100).catch(error => this.message(errorMessage(error))); });
  }
  private show(): void { this.get('spotify-panel').hidden = false; if (this.auth.connected) this.get('spotify-attribution').innerHTML = `<a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer">${spotifyMark}<span>Contenido proporcionado por Spotify</span></a>`; }
  private async action(action: string, id?: string): Promise<void> {
    if (action === 'show') { this.show(); return; }
    if (action === 'connect') { await this.auth.connect(); return; }
    if (action === 'disconnect') { this.playback.disconnect(); this.auth.disconnect(); await this.coordinator.useLocal(); return; }
    if (action === 'local') { await this.coordinator.useLocal(); return; }
    if (action === 'activate') { await this.playback.initialize(); this.playback.activate(); return; }
    if (action === 'toggle') { if (this.playback.state === 'playing') await this.playback.pause(); else await this.playback.resume(); return; }
    if (action === 'next') { await this.playback.next(); return; }
    if (action === 'previous') { await this.playback.previous(); return; }
    if (action === 'collection-previous' || action === 'collection-next') { this.collectionPage += action === 'collection-next' ? 1 : -1; this.renderCollection(); return; }
    if (action === 'remove' && id) { this.collection.remove(id); return; }
    if ((action === 'up' || action === 'down') && id) { this.collection.move(id, action === 'up' ? -1 : 1); return; }
    if ((action === 'play' || action === 'add') && id) {
      const track = this.currentPage.tracks.find(item => item.id === id) ?? [...this.collection.tracks].find(item => item.id === id); if (!track) return;
      if (action === 'add') { this.message(this.collection.add(track) ? 'Referencia añadida a la colección de esta sesión.' : 'La referencia ya está incluida o se alcanzó el límite de 100.'); return; }
      this.collection.tracks.setCurrent(track.id); await this.playback.playTrack(track); return;
    }
    if (action === 'browse' && id) { this.browse = this.currentPage.entities.find(item => item.id === id) ?? null; this.offset = 0; await this.search(); return; }
    if (action === 'search' || action === 'back') { this.query = this.get<HTMLInputElement>('spotify-query').value; this.browse = null; this.offset = 0; }
    else if (action === 'next-page') this.offset = this.currentPage.nextOffset ?? this.offset;
    else if (action === 'previous-page') this.offset = Math.max(0, this.offset - 10);
    await this.search();
  }
  private cancelSearch(): void { this.searchRevision++; this.controller?.abort(); this.controller = null; if (this.debounce) clearTimeout(this.debounce); this.debounce = null; this.busy = false; }
  private async search(): Promise<void> {
    this.cancelSearch(); if (!this.auth.connected) return;
    if (!this.browse && !this.query.trim()) { this.currentPage = { tracks: [], entities: [], nextOffset: null }; this.renderResults(); this.message('Escribe una canción, artista o álbum para buscar.'); return; }
    const revision = this.searchRevision; this.controller = new AbortController(); this.busy = true; this.message('Buscando en Spotify…'); this.renderAuth();
    try {
      const page = this.browse ? this.browse.type === 'album' ? await this.catalog.albumTracks(this.browse.id, this.offset, this.controller.signal) : await this.catalog.artistAlbums(this.browse.id, this.offset, this.controller.signal) : await this.catalog.search(this.query, this.get<HTMLSelectElement>('spotify-kind').value as 'track' | 'artist' | 'album', this.offset, this.controller.signal);
      if (revision !== this.searchRevision || !this.auth.connected) return; this.currentPage = page; this.renderResults(); this.message(page.tracks.length || page.entities.length ? this.browse ? `Explorando ${this.browse.name}` : 'Resultados proporcionados por Spotify.' : 'No encontramos resultados en Spotify.');
    } catch (error) { if (revision === this.searchRevision && this.auth.connected) { this.currentPage = { tracks: [], entities: [], nextOffset: null }; this.renderResults(); this.message(errorMessage(error)); if (error instanceof SpotifyError && error.code === 'forbidden') this.message(error.message + ' Esta función queda pendiente para los permisos actuales.'); } }
    finally { if (revision === this.searchRevision) { this.busy = false; this.renderAuth(); } }
  }
  private message(message: string): void { this.get('spotify-message').textContent = message; }
  private renderAuth(): void {
    this.get('spotify-auth-status').textContent = this.auth.status; this.get('spotify-user').textContent = this.auth.connected ? this.auth.displayName : '';
    const connect = this.get<HTMLButtonElement>('spotify-connect'); connect.hidden = this.auth.connected; connect.disabled = !this.auth.canConnect || this.auth.state === 'connecting'; connect.textContent = this.auth.state === 'connecting' ? 'Conectando…' : ['expired', 'error'].includes(this.auth.state) ? 'Reconectar' : 'Conectar con Spotify';
    this.get('spotify-disconnect').hidden = !this.auth.connected; this.get('spotify-activate').hidden = !this.auth.connected;
    this.get('spotify-config').textContent = !this.auth.configured ? 'Spotify no está configurado. Mi música sigue funcionando.' : !this.auth.canConnect ? `Para conectar, abre Sonaris en ${new URL(this.auth.configuration.redirectUri).origin}. La Redirect URI debe coincidir con el Dashboard.` : 'Configuración pública preparada. La conexión y reproducción requieren autorización real de la cuenta.';
    for (const id of ['spotify-query', 'spotify-kind', 'spotify-search-button']) (this.get(id) as HTMLInputElement).disabled = !this.auth.connected || (id === 'spotify-search-button' && this.busy);
    this.get<HTMLButtonElement>('spotify-next-page').disabled = !this.auth.connected || this.busy || this.currentPage.nextOffset === null; this.get<HTMLButtonElement>('spotify-previous-page').disabled = !this.auth.connected || this.busy || this.offset === 0;
    this.get('spotify-back').hidden = !this.browse;
    if (this.auth.state !== 'disconnected') this.show();
  }
  private image(url: string | null): string { return url && artworkUrl(url) ? `<img class="spotify-artwork" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="spotify-artwork spotify-artwork-empty" aria-hidden="true">♪</span>'; }
  private trackRow(track: MusicReference, collection = false, index = 0): string {
    const available = this.playback.available && track.playbackCapability === 'spotify-premium';
    return `<article class="spotify-result">${this.image(track.artworkUrl)}<div><a class="spotify-track-link" href="${escapeHtml(track.externalUrl!)}" target="_blank" rel="noopener noreferrer">${escapeHtml(track.title)}</a><small>${escapeHtml(track.artistName)}${track.albumName ? ' · ' + escapeHtml(track.albumName) : ''}</small><small>Spotify · ${formatTime(track.duration)} · ${track.playbackCapability === 'unavailable' ? 'Reproducción restringida' : 'Requiere Premium y autorización'}</small></div><div class="spotify-result-actions"><button class="quiet-button" data-spotify-action="play" data-id="${track.id}" ${available ? '' : 'disabled'} aria-label="Reproducir ${escapeHtml(track.title)} en Spotify">Reproducir en Spotify</button>${collection ? `<button class="quiet-button" data-spotify-action="up" data-id="${track.id}" ${index === 0 ? 'disabled' : ''}>Mover arriba</button><button class="quiet-button" data-spotify-action="down" data-id="${track.id}" ${index === this.collection.tracks.getSize() - 1 ? 'disabled' : ''}>Mover abajo</button><button class="quiet-button danger" data-spotify-action="remove" data-id="${track.id}">Quitar referencia</button>` : `<button class="quiet-button" data-spotify-action="add" data-id="${track.id}">Guardar referencia en esta sesión</button>`}</div></article>`;
  }
  private renderResults(): void {
    this.get('spotify-results').innerHTML = this.currentPage.tracks.map(track => this.trackRow(track)).join('') + this.currentPage.entities.map(entity => `<article class="spotify-result">${this.image(entity.artworkUrl)}<div><a class="spotify-track-link" href="${entity.externalUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(entity.name)}</a><small>${escapeHtml(entity.artistName)} · Spotify</small></div><button class="quiet-button" data-spotify-action="browse" data-id="${entity.id}">${entity.type === 'artist' ? 'Explorar álbumes' : 'Ver canciones'}</button></article>`).join('');
    this.get('spotify-page').textContent = this.currentPage.tracks.length || this.currentPage.entities.length ? `Página ${Math.floor(this.offset / 10) + 1}` : '';
  }
  private renderCollection(): void { const tracks = [...this.collection.tracks]; this.collectionPage = Math.max(0, Math.min(this.collectionPage, Math.ceil(tracks.length / 10) - 1)); this.get('spotify-collection').innerHTML = tracks.slice(this.collectionPage * 10, (this.collectionPage + 1) * 10).map((track, index) => this.trackRow(track, true, this.collectionPage * 10 + index)).join('') || '<p class="feature-empty">No hay referencias guardadas en esta sesión.</p>'; this.get<HTMLButtonElement>('spotify-collection-previous').disabled = this.collectionPage === 0; this.get<HTMLButtonElement>('spotify-collection-next').disabled = (this.collectionPage + 1) * 10 >= tracks.length; this.get('spotify-collection-page').textContent = tracks.length ? `${tracks.length} referencias · Página ${this.collectionPage + 1}` : ''; }
  private renderPlayback(): void {
    this.get('spotify-playback-status').textContent = this.playback.status;
    const track = this.playback.track, signature = track?.id ?? '';
    if (signature !== this.renderedTrack) { this.renderedTrack = signature; this.get('spotify-now').innerHTML = track ? `${this.image(track.artworkUrl)}<div><a class="spotify-track-link" href="${track.externalUrl!}" target="_blank" rel="noopener noreferrer">${escapeHtml(track.title)}</a><small>${escapeHtml(track.artistName)} · Spotify</small></div>` : '<p class="feature-note">Selecciona una canción para escuchar en el dispositivo Spotify.</p>'; }
    const playing = this.playback.state === 'playing'; this.get('spotify-toggle').textContent = playing ? 'Pausar Spotify' : 'Reanudar Spotify'; this.get<HTMLButtonElement>('spotify-toggle').disabled = playing ? !this.playback.canPause : !this.playback.canResume;
    this.get<HTMLButtonElement>('spotify-next').disabled = !this.playback.canNext; this.get<HTMLButtonElement>('spotify-previous').disabled = !this.playback.canPrevious;
    const progress = this.get<HTMLInputElement>('spotify-progress'); progress.disabled = !this.playback.canSeek; if (document.activeElement !== progress) progress.value = String(this.playback.duration ? this.playback.position / this.playback.duration * 1000 : 0);
    this.get('spotify-time').textContent = formatTime(this.playback.position); this.get('spotify-duration').textContent = formatTime(this.playback.duration);
    const volume = this.get<HTMLInputElement>('spotify-volume'); volume.disabled = !this.playback.available || !this.playback.volumeAvailable; if (document.activeElement !== volume) volume.value = String(Math.round(this.playback.volume * 100));
    this.container.querySelectorAll<HTMLButtonElement>('[data-spotify-action=play]').forEach(button => { const track = this.currentPage.tracks.find(item => item.id === button.dataset.id) ?? [...this.collection.tracks].find(item => item.id === button.dataset.id); button.disabled = !this.playback.available || track?.playbackCapability !== 'spotify-premium'; });
  }
  refreshSource(): void { this.renderSource(); }
  private renderSource(): void {
    const spotify = this.coordinator.source === 'spotify'; this.get('active-source').textContent = spotify ? 'Escuchando Spotify' : 'Mi música'; this.get('active-source').classList.toggle('spotify-active', spotify);
    const root = this.container.closest('#app'); if (!root) return;
    root.querySelector<HTMLElement>('.player')?.setAttribute('data-source', this.coordinator.source);
    // Preserve previous disabled states when returning to local controls.
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('.player button,.player input,.player select,#panel-audio button,#panel-audio input,#panel-audio select,#panel-sleep button,#panel-sleep input,#panel-sleep select').forEach(control => {
      if (spotify) { if (!control.hasAttribute('data-local-disabled')) control.dataset.localDisabled = String(control.disabled); control.disabled = true; }
      else if (control.hasAttribute('data-local-disabled')) { control.disabled = control.dataset.localDisabled === 'true'; delete control.dataset.localDisabled; }
    });
    let note = root.querySelector<HTMLElement>('#local-source-note'); if (!note) { note = document.createElement('p'); note.id = 'local-source-note'; note.className = 'local-source-note'; root.querySelector('.player')?.prepend(note); }
    note.hidden = !spotify; note.textContent = 'Spotify está activo. Usa sus controles o vuelve a Mi música para escuchar archivos y activar sus efectos.';
  }
  dispose(): void { this.cancelSearch(); this.auth.removeEventListener('change', this.authChanged); this.playback.removeEventListener('change', this.playbackChanged); this.collection.removeEventListener('change', this.collectionChanged); this.coordinator.removeEventListener('change', this.sourceChanged); this.container.closest('#app')?.removeEventListener('librarychange', this.localChanged); }
}
