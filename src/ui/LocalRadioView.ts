import type { LocalRadioService } from '../radio/LocalRadioService';
import type { AudioPlayerService } from '../services/AudioPlayerService';
import type { AppView } from './AppView';
import type { Song } from '../models/Song';
import { escapeHtml } from './formatters';
export class LocalRadioView {
  private query = '';
  private page = 0;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private readonly changed = () => { this.renderRadio(); this.renderLibrary(); };
  private readonly libraryChanged = () => { this.renderLibrary(); this.renderRadio(); };
  constructor(private readonly container: HTMLElement, private readonly radio: LocalRadioService, private readonly player: AudioPlayerService, private readonly app: AppView) {
    container.innerHTML = `<section class="local-discovery" aria-labelledby="local-discovery-title"><div class="discovery-heading"><div><span class="eyebrow">DESCUBRE LO QUE YA ES TUYO</span><h2 id="local-discovery-title">Tu biblioteca, nuevos caminos</h2><p>Escucha tus archivos y encuentra otra forma de conectarlos.</p></div><span class="local-pill">100 % local</span></div><div class="local-search"><label for="library-search">Buscar en toda tu biblioteca</label><input id="library-search" type="search" maxlength="200" placeholder="Canción, artista, álbum o género…"><span id="library-result-count"></span></div><div id="local-library-results"></div><div class="local-pagination"><button class="quiet-button" id="library-previous" data-radio-action="previous-page">Página anterior</button><span id="library-page"></span><button class="quiet-button" id="library-next" data-radio-action="next-page">Página siguiente</button></div><div class="radio-panel"><div class="radio-heading"><span class="radio-symbol" aria-hidden="true">✦</span><div><span class="eyebrow">UNA MEZCLA HECHA CON TU MÚSICA</span><h2>Radio de Sonaris</h2></div></div><p id="radio-status" role="status" aria-live="polite"></p><div class="radio-settings"><label>Selección reproducible<input id="radio-seed" type="number" min="0" max="4294967295" step="1" value="1"></label><label>Canciones por selección<input id="radio-count" type="number" min="1" max="50" step="1" value="12"></label><label class="radio-checkbox"><input id="radio-automatic" type="checkbox"> Crear radio al escuchar desde la biblioteca</label><label class="radio-checkbox"><input id="radio-continuous" type="checkbox" checked> Reproducción continua</label></div><p class="feature-note">La misma selección y biblioteca producen el mismo orden. Se usan las etiquetas disponibles; sin etiquetas, elegimos al azar entre tus archivos. No inventamos relaciones musicales.</p><div class="radio-actions"><button class="button primary" data-radio-action="current" id="radio-current">Crear radio de esta canción</button><button class="quiet-button" data-radio-action="regenerate" id="radio-regenerate">Generar nueva selección</button><button class="quiet-button" data-radio-action="resume" id="radio-resume">Escuchar radio</button><button class="quiet-button danger" data-radio-action="end" id="radio-end">Finalizar radio</button></div><div id="radio-session" hidden><h3 id="radio-seed-title"></h3><p class="feature-note">Selecciona la radio en Mis playlists para recorrer, reordenar, inspeccionar nodos o eliminar recomendaciones con Deshacer y Rehacer.</p><h4>Canciones de esta selección</h4><ol id="radio-reasons"></ol><form id="radio-save-form"><label for="radio-name">Nombre de la playlist</label><input id="radio-name" required maxlength="100" value="Mi radio local"><button type="submit" class="button primary">Guardar como playlist</button></form></div></div></section>`;
    this.get<HTMLInputElement>('radio-automatic').checked = radio.automatic; this.get<HTMLInputElement>('radio-continuous').checked = radio.continuous;
    this.get<HTMLInputElement>('library-search').addEventListener('input', () => { if (this.debounce) clearTimeout(this.debounce); this.debounce = setTimeout(() => { this.query = this.get<HTMLInputElement>('library-search').value; this.page = 0; this.renderLibrary(); }, 180); });
    for (const id of ['radio-automatic', 'radio-continuous']) this.get<HTMLInputElement>(id).addEventListener('change', () => radio.configure(this.get<HTMLInputElement>('radio-automatic').checked, this.get<HTMLInputElement>('radio-continuous').checked));
    container.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-radio-action]'); if (!button || button.disabled) return; void this.action(button.dataset.radioAction!, button.dataset.id).catch(() => this.message('No se pudo completar la operación. Comprueba la selección y los archivos disponibles.')); });
    this.get<HTMLFormElement>('radio-save-form').addEventListener('submit', event => { event.preventDefault(); try { radio.save(this.get<HTMLInputElement>('radio-name').value); this.app.refresh(); } catch { this.message('Escribe un nombre de entre 1 y 100 caracteres.'); } });
    radio.addEventListener('change', this.changed); container.closest('#app')?.addEventListener('librarychange', this.libraryChanged);
    player.addEventListener('change', this.playbackChanged); this.changed();
  }
  private readonly playbackChanged = () => { this.get<HTMLButtonElement>('radio-current').disabled = !this.player.song; };
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.container.querySelector<T>(`#${id}`)!; }
  private message(value: string): void { this.get('radio-status').textContent = value; }
  private configureSelection(): void {
    const seed = Number(this.get<HTMLInputElement>('radio-seed').value), count = Number(this.get<HTMLInputElement>('radio-count').value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(count) || count < 1 || count > 50) throw new Error('Invalid selection');
    this.radio.selectionSeed = seed; this.radio.batchSize = count;
  }
  private async action(action: string, id?: string): Promise<void> {
    if (action === 'previous-page' || action === 'next-page') { this.page += action === 'next-page' ? 1 : -1; this.renderLibrary(); return; }
    if (action === 'end') { this.radio.end(); this.app.refresh(); return; }
    if (action === 'resume' && this.radio.playlist) { this.radio.library.select(this.radio.playlist.id); this.player.attach(this.radio.playlist); this.app.refresh(); await this.player.play(); return; }
    this.configureSelection();
    if (action === 'regenerate') { this.radio.regenerate(); this.app.refresh(); return; }
    const song = id ? this.radio.find(id) : this.player.song;
    if (!song) { this.message('Importa y selecciona una canción para comenzar.'); return; }
    if (action === 'add') { this.radio.add(song); this.app.refresh(); }
    else if (action === 'preview') { const playback = this.radio.preview(song); this.app.refresh(); await playback; }
    else if (action === 'create' || action === 'current') { this.radio.start(song); this.app.refresh(); await this.player.play(); }
  }
  private matched(): Song[] {
    const query = this.query.toLocaleLowerCase('es'); return [...this.radio.songs()].filter(song => `${song.title} ${song.artist ?? ''} ${song.metadata.album ?? ''} ${(song.metadata.genres ?? []).join(' ')} ${(song.metadata.tags ?? []).join(' ')}`.toLocaleLowerCase('es').includes(query));
  }
  private renderLibrary(): void {
    const songs = this.matched(); this.page = Math.max(0, Math.min(this.page, Math.ceil(songs.length / 8) - 1));
    this.get('library-result-count').textContent = `${songs.length} archivos únicos`; this.get('library-page').textContent = songs.length ? `Página ${this.page + 1} de ${Math.ceil(songs.length / 8)}` : '';
    this.get<HTMLButtonElement>('library-previous').disabled = this.page === 0; this.get<HTMLButtonElement>('library-next').disabled = (this.page + 1) * 8 >= songs.length;
    this.get('local-library-results').innerHTML = songs.length ? songs.slice(this.page * 8, (this.page + 1) * 8).map(song => `<article class="local-song-card"><span class="local-song-symbol" aria-hidden="true">♪</span><div><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml([song.artist, song.metadata.album].filter(Boolean).join(' · ') || 'Archivo importado por ti')}</small></div><div class="local-song-actions"><button class="quiet-button" data-radio-action="preview" data-id="${song.id}" aria-label="Escuchar ${escapeHtml(song.title)} desde la biblioteca">Escuchar</button><button class="quiet-button" data-radio-action="create" data-id="${song.id}" aria-label="Crear radio de ${escapeHtml(song.title)}">Crear radio</button>${this.radio.playlist ? `<button class="quiet-button" data-radio-action="add" data-id="${song.id}" aria-label="Agregar ${escapeHtml(song.title)} a la radio">Agregar a la radio</button>` : ''}</div></article>`).join('') : `<p class="feature-empty">${this.query ? 'No encontramos archivos con esa búsqueda.' : 'Importa archivos de audio para descubrir nuevas mezclas de tu música.'}</p>`;
  }
  private renderRadio(): void {
    this.message(this.radio.status); this.playbackChanged();
    for (const id of ['radio-regenerate', 'radio-resume', 'radio-end']) this.get<HTMLButtonElement>(id).disabled = !this.radio.playlist;
    this.get('radio-session').hidden = !this.radio.playlist;
    if (!this.radio.playlist || !this.radio.seed) return;
    this.get('radio-seed-title').textContent = `Basada en esta canción: ${this.radio.seed.title}`;
    this.get('radio-reasons').innerHTML = [...this.radio.playlist.songs].map((song, index) => `<li><strong>${escapeHtml(song.title)}</strong><small>${index === 0 ? 'Canción inicial' : escapeHtml(this.radio.explanations.get(song.libraryKey)?.reasons.join(' · ') ?? 'Agregada por ti')}</small></li>`).join('');
  }
  dispose(): void { if (this.debounce) clearTimeout(this.debounce); this.radio.removeEventListener('change', this.changed); this.player.removeEventListener('change', this.playbackChanged); this.container.closest('#app')?.removeEventListener('librarychange', this.libraryChanged); }
}
