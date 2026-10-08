import type { PlaylistService } from '../services/PlaylistService';
import type { AudioPlayerService } from '../services/AudioPlayerService';
import type { SongImporter } from '../patterns/factory/SongImporter';
import { PlaylistEditor } from '../services/PlaylistEditor';
import type { RepeatMode } from '../models/Playlist';
import { LocalMetadataReader } from '../services/LocalMetadataReader';
import { escapeHtml,formatTime } from './formatters';
const icons = {
  music: '<path d="M9 18V5l12-2v13M9 5l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  previous: '<path d="M5 5v14m14-14L7 12l12 7Z"/>', next: '<path d="M19 5v14M5 5l12 7-12 7Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', delete: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
};
const icon = (name: keyof typeof icons): string => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
export class AppView {
  private readonly metadataReader = new LocalMetadataReader();
  refresh(): void { this.render(); }
  private academicMode = true;
  private structureSignature = '';
  private query = '';
  private inspectedNode: string | null = null;
  private draggedId: string | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private insertion: { playlistId: string; position: number; placement: string } | null = null;
  constructor(private readonly root: HTMLElement, private readonly playlists: PlaylistService, private readonly player: AudioPlayerService, private readonly importer: SongImporter, readonly editor = new PlaylistEditor(playlists,player)) {
    this.shell(); this.bind(); this.render();
    editor.addEventListener('change',()=>{ this.render(); });
    player.addEventListener('change', () => this.updatePlayer());
    player.addEventListener('playbackerror', () => this.message('No se pudo reproducir el archivo. Comprueba que su formato sea compatible con tu navegador.', true));
  }
  private element<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector<T>(`#${id}`)!; }
  private shell(): void {
    this.root.innerHTML = `
    <header class="topbar"><a class="brand" href="#" aria-label="Sonaris, inicio"><span class="brand-mark">${icon('music')}</span>Sonaris<span class="brand-dot">.</span></a><span class="header-note">TU ESPACIO SONORO</span><label class="search">${icon('search')}<span class="sr-only">Buscar canciones en la playlist</span><input id="search" type="search" placeholder="Buscar en tu playlist…" autocomplete="off"></label></header>
    <main class="workspace"><aside class="sidebar"><div class="sidebar-heading"><span class="eyebrow">TU BIBLIOTECA</span><span class="small-badge" id="playlist-count"></span></div><h2>Mis playlists</h2><button class="button new-playlist" data-action="create">${icon('plus')} Nueva playlist</button><nav id="playlists" aria-label="Mis playlists"></nav><div class="sidebar-tip"><span class="tip-symbol">↔</span><strong>Todo está conectado</strong><p>Cada canción tiene una anterior y una siguiente. Tú decides el orden.</p><button class="text-button" data-action="structure">Ver cómo funciona</button></div><p class="local-note">Tu música se queda en tu navegador.</p></aside>
    <section class="library" aria-labelledby="playlist-title"><div class="welcome"><span class="eyebrow">DALE PLAY A TU DÍA</span><p>Tu música, organizada a tu manera.</p></div><div class="playlist-banner"><div class="cover">${icon('music')}<span>SONARIS</span></div><div class="playlist-summary"><span class="eyebrow">PLAYLIST PERSONAL</span><h1 id="playlist-title"></h1><p id="playlist-description"></p><span id="song-count" class="summary-count"></span></div><div class="banner-decoration" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>
    <div class="history-toolbar"><button class="quiet-button" id="undo" data-action="undo">Deshacer</button><button class="quiet-button" id="redo" data-action="redo">Rehacer</button><button class="quiet-button" data-action="structure">Visualizador de lista doble</button></div><div class="library-toolbar"><h2>Canciones <span id="track-total" class="small-badge"></span></h2><div class="playlist-actions"><button class="quiet-button" data-action="rename">Renombrar</button><button class="quiet-button" data-action="duplicate">Duplicar playlist</button><button class="quiet-button danger" data-action="delete-playlist">Eliminar playlist</button></div></div>
    <div class="insert-panel"><label for="placement">Agregar canciones</label><select id="placement"><option value="last">Al final</option><option value="first">Al inicio</option><option value="position">En una posición</option></select><label id="position-label" class="position-control" hidden>Posición <input id="position" type="number" min="1" value="1" step="1"></label><button class="button primary" data-action="import">${icon('plus')} Seleccionar archivos</button><input id="audio-files" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.opus,.webm" multiple hidden></div>
    <p class="position-help" id="position-help">Elige dónde agregar tus archivos. Las posiciones comienzan en 1.</p><div class="track-heading" aria-hidden="true"><span>#</span><span>TÍTULO / ARTISTA</span><span>DURACIÓN</span><span></span></div><div id="tracks"></div><div id="structure" class="structure-panel" hidden></div>
    <div id="spotify-tools"></div><div id="local-discovery"></div><div id="advanced-tools"></div><div class="library-footer"><span>Archivos locales · Sin cuenta · Sin anuncios</span><span>Hecho para escuchar y aprender</span></div></section></main>
    <section class="player" aria-label="Reproductor de música"><div class="now-playing"><div class="mini-cover">${icon('music')}</div><div><span class="eyebrow">REPRODUCIENDO AHORA</span><strong id="now-title">Tu próxima canción te espera</strong><span id="now-artist">Selecciona un archivo para empezar</span><span id="playback-status" role="status"></span></div></div><div class="transport"><div class="transport-buttons"><button id="previous" class="icon-button" data-action="previous" aria-label="Canción anterior">${icon('previous')}</button><button id="play" class="play-button" data-action="play" aria-label="Reproducir">${icon('play')}</button><button id="next" class="icon-button" data-action="next" aria-label="Canción siguiente">${icon('next')}</button></div><div class="progress-row"><span id="current-time">00:00</span><label class="sr-only" for="progress">Progreso de reproducción</label><input id="progress" type="range" min="0" max="1000" value="0"><span id="duration">00:00</span></div></div><div class="player-settings"><div class="volume-row"><label for="volume">Volumen</label><input id="volume" type="range" min="0" max="100" value="65"><output id="volume-value" for="volume">65 %</output></div><label class="mode-label" for="repeat">Modo<select id="repeat"><option value="normal">Normal</option><option value="one">Repetir canción</option><option value="all">Repetir playlist</option><option value="shuffle" title="Un ciclo sin repetir; la cola manual tiene prioridad">Aleatorio</option></select></label><div class="effects"><label><input id="fade" type="checkbox"> Entrada gradual</label><label><input id="boost" type="checkbox"> Refuerzo de volumen</label></div></div></section>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="playlist-dialog" aria-labelledby="dialog-title"><form id="playlist-form"><h2 id="dialog-title">Nueva playlist</h2><p id="dialog-description">Dale un nombre a tu próximo momento musical.</p><label id="name-label" for="playlist-name">Nombre de la playlist</label><input id="playlist-name" required maxlength="100" placeholder="Por ejemplo, tardes tranquilas"><label id="description-label" for="description">Descripción (opcional)</label><textarea id="description" maxlength="400" rows="3"></textarea><p id="dialog-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="quiet-button" data-action="cancel">Cancelar</button><button id="dialog-submit" type="submit" class="button primary">Crear playlist</button></div></form></dialog>`;
  }
  private dialogAction: 'create' | 'rename' | 'delete-playlist' = 'create';
  private openDialog(action: 'create' | 'rename' | 'delete-playlist'): void {
    this.dialogAction = action;
    const deleting = action === 'delete-playlist';
    this.element('dialog-title').textContent = action === 'create' ? 'Nueva playlist' : deleting ? 'Eliminar playlist' : 'Renombrar playlist';
    this.element('dialog-description').textContent = deleting ? `Se eliminará «${this.playlists.active.name}» y sus canciones de esta biblioteca.` : 'Dale un nombre a tu próximo momento musical.';
    for (const id of ['playlist-name', 'name-label', 'description', 'description-label']) this.element(id).hidden = deleting || (action === 'rename' && id.includes('description'));
    const name = this.element<HTMLInputElement>('playlist-name'); name.required = !deleting; name.value = action === 'rename' ? this.playlists.active.name : '';
    this.element<HTMLTextAreaElement>('description').value = ''; this.element('dialog-error').textContent = '';
    this.element('dialog-submit').textContent = action === 'create' ? 'Crear playlist' : deleting ? 'Eliminar playlist' : 'Guardar nombre';
    this.element<HTMLDialogElement>('playlist-dialog').showModal();
    if (!deleting) name.focus();
  }
  private bind(): void {
    this.root.addEventListener('dragstart',event=>{
      const row=(event.target as HTMLElement).closest<HTMLElement>('.track-row');
      if (!row) return; this.draggedId=row.dataset.songId!; (event as DragEvent).dataTransfer?.setData('text/plain',this.draggedId);
    });
    this.root.addEventListener('dragover',event=>{ const row=(event.target as HTMLElement).closest('.track-row'); if (!row || !this.draggedId) return; event.preventDefault(); this.root.querySelectorAll('.drop-target').forEach(item=>item.classList.remove('drop-target')); row.classList.add('drop-target'); });
    this.root.addEventListener('drop',event=>{const row=(event.target as HTMLElement).closest<HTMLElement>('.track-row'); if (row && this.draggedId) { event.preventDefault(); this.editor.move(this.playlists.active,this.draggedId,this.playlists.active.songs.indexOf(row.dataset.songId!)); } this.draggedId=null; this.root.querySelectorAll('.drop-target').forEach(item=>item.classList.remove('drop-target'));});
    this.root.addEventListener('dragend',()=>{this.draggedId=null; this.root.querySelectorAll('.drop-target').forEach(item=>item.classList.remove('drop-target'));});
    this.root.addEventListener('change',event=>{if ((event.target as HTMLElement).id==='academic-mode') { this.academicMode=(event.target as HTMLInputElement).checked; this.element('operation-explanation').hidden=!this.academicMode; }});
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.disabled) return;
      void this.action(button.dataset.action!, button.dataset.id);
    });
    this.element<HTMLFormElement>('playlist-form').addEventListener('submit', event => {
      event.preventDefault();
      const name = this.element<HTMLInputElement>('playlist-name').value.trim();
      if (this.dialogAction !== 'delete-playlist' && !name) { this.element('dialog-error').textContent = 'Escribe un nombre válido para la playlist.'; return; }
      if (this.dialogAction === 'create') { const playlist = this.playlists.create(name, this.element<HTMLTextAreaElement>('description').value.trim()); this.playlists.select(playlist.id); this.player.attach(playlist); }
      else if (this.dialogAction === 'rename') this.editor.rename(this.playlists.active,name);
      else { this.player.stop(); this.editor.delete(this.playlists.active); }
      this.element<HTMLDialogElement>('playlist-dialog').close(); this.render(); this.message(this.dialogAction === 'create' ? 'Playlist creada correctamente.' : this.dialogAction === 'rename' ? 'Nombre actualizado.' : 'Playlist eliminada.');
    });
    this.element<HTMLInputElement>('search').addEventListener('input', event => { this.query = (event.target as HTMLInputElement).value; this.renderTracks(); });
    this.element<HTMLSelectElement>('placement').addEventListener('change', () => { this.element('position-label').hidden = this.element<HTMLSelectElement>('placement').value !== 'position'; });
    this.element<HTMLInputElement>('audio-files').addEventListener('change', event => { this.importFiles((event.target as HTMLInputElement).files); (event.target as HTMLInputElement).value = ''; });
    this.element<HTMLInputElement>('volume').addEventListener('input', event => this.player.setVolume(Number((event.target as HTMLInputElement).value) / 100));
    this.element<HTMLInputElement>('progress').addEventListener('input', event => this.player.seek(Number((event.target as HTMLInputElement).value) / 1000));
    this.element<HTMLSelectElement>('repeat').addEventListener('change', event => { this.player.setMode((event.target as HTMLSelectElement).value as RepeatMode); this.persist(); });
    for (const id of ['fade', 'boost']) this.element<HTMLInputElement>(id).addEventListener('change', () => { void this.player.setEffects(this.element<HTMLInputElement>('fade').checked, this.element<HTMLInputElement>('boost').checked); });
  }
  private async action(action: string, id?: string): Promise<void> {
    if (action === 'create' || action === 'rename' || action === 'delete-playlist') this.openDialog(action);
    else if (action === 'cancel') this.element<HTMLDialogElement>('playlist-dialog').close();
    else if (action === 'select-playlist' && id) { this.playlists.select(id); this.player.attach(this.playlists.active); this.query = ''; this.element<HTMLInputElement>('search').value = ''; this.render(); }
    else if (action === 'duplicate') { const copy = this.editor.duplicate(this.playlists.active); this.playlists.select(copy.id); this.player.attach(copy); this.render(); this.message('Playlist duplicada con nodos independientes.'); }
    else if (action === 'import') {
      const size = this.playlists.active.songs.getSize();
      const placement = this.element<HTMLSelectElement>('placement').value;
      const position = placement === 'first' ? 0 : placement === 'last' ? size : Number(this.element<HTMLInputElement>('position').value) - 1;
      if (!Number.isInteger(position) || position < 0 || position > size) { this.message(`Elige una posición entre 1 y ${size + 1}.`, true); return; }
      this.insertion = { playlistId: this.playlists.active.id, position, placement }; this.element<HTMLInputElement>('audio-files').click();
    } else if (action === 'select-song' && id) { this.player.select(id); await this.player.play(); this.renderTracks(); }
    else if (action === 'remove-song' && id) {
      this.editor.remove(this.playlists.active,id); this.render(); this.message('Canción eliminada.');
    } else if (action === 'play') { if (this.player.state === 'playing' || this.player.state === 'loading') this.player.pause(); else await this.player.play(); }
    else if (action === 'next') { await this.player.next(); this.editor.navigation('next'); this.renderTracks(); }
    else if (action === 'previous') { await this.player.previous(); this.editor.navigation('previous'); this.renderTracks(); }
    else if (action === 'undo') this.editor.undo();
    else if (action === 'redo') this.editor.redo();
    else if ((action === 'move-up' || action === 'move-down') && id) this.editor.move(this.playlists.active,id,this.playlists.active.songs.indexOf(id)+(action==='move-up'?-1:1));
    else if ((action === 'queue-first' || action === 'queue-last') && id) { const index=this.playlists.active.songs.indexOf(id); if (index>=0) { this.player.queue.add(this.playlists.active.songs.getAt(index),this.playlists.active.id,this.playlists.active.name,action==='queue-first'); this.updatePlayer(); this.message('Canción agregada a la cola.'); } }
    else if (action === 'inspect-node' && id) { this.inspectedNode = id; this.renderStructure(); }
    else if (action === 'structure') { this.element('structure').hidden = !this.element('structure').hidden; this.renderStructure(); }
  }
  private importFiles(files: FileList | null): void {
    if (!files?.length || !this.insertion) return;
    const playlist = this.playlists.playlists.get(this.insertion.playlistId);
    if (!playlist) { this.message('La playlist de destino ya no existe.', true); return; }
    let position = Math.min(this.insertion.position, playlist.songs.getSize()); let added = 0; let rejected = 0;
    for (const file of files) {
      try {
        const song = this.importer.import(file);
        this.editor.add(playlist,song,position,this.insertion.placement);
        position++; added++;
        void this.metadataReader.read(file).then(metadata => { if (playlist.songs.indexOf(song.id) >= 0 && Object.values(metadata).some(value => Array.isArray(value) ? value.length > 0 : !!value)) { for (const item of this.playlists.playlists.values()) for (const entry of item.songs) if (entry.libraryKey === song.libraryKey) entry.applyMetadata(metadata); this.render(); } });
      } catch { rejected++; }
    }
    this.insertion = null; this.player.sync(); this.render();
    this.message(`${added} ${added === 1 ? 'canción agregada' : 'canciones agregadas'}.${rejected ? ` ${rejected} archivos rechazados por formato o tamaño vacío.` : ''}`, rejected > 0);
  }
  private persist(): void { if (!this.playlists.save()) this.message('El navegador no permite guardar la configuración. Puedes seguir escuchando durante esta sesión.', true); }
  private render(): void {
    const playlist = this.playlists.active;
    this.element<HTMLButtonElement>('undo').disabled = !this.editor.history.canUndo; this.element<HTMLButtonElement>('redo').disabled = !this.editor.history.canRedo;
    this.element('playlist-count').textContent = String(this.playlists.playlists.size);
    this.element('playlists').innerHTML = [...this.playlists.playlists.values()].map(item => `<button class="playlist-item ${item.id === playlist.id ? 'active' : ''}" data-action="select-playlist" data-id="${item.id}" ${item.id === playlist.id ? 'aria-current="true"' : ''}><span class="playlist-icon">${icon('music')}</span><span>${escapeHtml(item.name)}<small>${item.songs.getSize()} canciones</small></span><span class="playlist-arrow">›</span></button>`).join('');
    this.element('playlist-title').textContent = playlist.name; this.element('playlist-description').textContent = playlist.description || 'Un lugar para las canciones que te acompañan.';
    this.root.querySelectorAll<HTMLButtonElement>('[data-action=rename],[data-action=delete-playlist]').forEach(button => { button.disabled = playlist.temporary; });
    this.element('song-count').textContent = `${playlist.songs.getSize()} canciones · Archivos en este dispositivo`;
    this.element('track-total').textContent = String(playlist.songs.getSize()); this.element<HTMLInputElement>('position').max = String(playlist.songs.getSize() + 1);
    this.renderTracks(); this.updatePlayer(); this.renderStructure();
    this.root.dispatchEvent(new Event('librarychange'));
  }
  private renderTracks(): void {
    const playlist = this.playlists.active;
    let count = 0; let position = 0; let html = '';
    for (const song of playlist.songs) {
      position++; if (!`${song.title} ${song.artist ?? ''}`.toLocaleLowerCase('es').includes(this.query.toLocaleLowerCase('es'))) continue;
      count++;
      html += `<div draggable="true" class="track-row ${playlist.songs.current?.song.id === song.id ? 'selected' : ''}" data-song-id="${song.id}"><span class="track-index">${position}</span><button class="track-title" data-action="select-song" data-id="${song.id}" aria-label="Reproducir ${escapeHtml(song.title)}"><span class="track-art">${icon('music')}</span><span><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.artist ?? 'Artista desconocido')}</small></span></button><span class="track-duration" data-duration-id="${song.id}">${song.duration ? formatTime(song.duration) : '—'}</span><div class="track-controls"><details class="track-menu"><summary aria-label="Opciones de ${escapeHtml(song.title)}">⋯</summary><div><button data-action="move-up" data-id="${song.id}" ${position===1?'disabled':''}>Mover arriba</button><button data-action="move-down" data-id="${song.id}" ${position===playlist.songs.getSize()?'disabled':''}>Mover abajo</button><button data-action="queue-first" data-id="${song.id}">Reproducir a continuación</button><button data-action="queue-last" data-id="${song.id}">Agregar a la cola</button></div></details><button class="icon-button remove" data-action="remove-song" data-id="${song.id}" aria-label="Eliminar ${escapeHtml(song.title)}">${icon('delete')}</button></div></div>`;
    }
    if (!count) html = playlist.songs.isEmpty() ? `<div class="empty-state"><span class="empty-art">${icon('upload')}</span><h3>Tu playlist empieza contigo</h3><p>Selecciona tus archivos de audio y dale vida a este espacio.<br>MP3, WAV, M4A, OGG y otros formatos compatibles.</p><button class="button primary" data-action="import">${icon('plus')} Agregar canciones</button><small>Solo tú eliges qué archivos compartir con Sonaris.</small></div>` : '<div class="empty-state"><h3>No encontramos esa canción</h3><p>Prueba con otro título o borra la búsqueda.</p></div>';
    this.element('tracks').innerHTML = html; this.renderStructure();
  }
  private updatePlayer(): void {
    const song = this.player.song; const playing = this.player.state === 'playing' || this.player.state === 'loading';
    this.element('now-title').textContent = song?.title ?? 'Tu próxima canción te espera'; this.element('now-artist').textContent = song ? song.artist ?? 'Artista desconocido' : 'Selecciona un archivo para empezar';
    this.element('playback-status').textContent = this.player.shuffleFinished ? 'Ciclo aleatorio terminado' : ({ idle: 'Sin reproducción', loading: 'Cargando…', playing: 'Reproduciendo', paused: 'En pausa', error: 'Archivo no reproducible' })[this.player.state];
    const play = this.element<HTMLButtonElement>('play'); play.disabled = !song; play.innerHTML = icon(playing ? 'pause' : 'play'); play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    this.element<HTMLButtonElement>('previous').disabled = !this.player.canPrevious; this.element<HTMLButtonElement>('next').disabled = !this.player.canNext;
    this.element('current-time').textContent = formatTime(this.player.currentTime); this.element('duration').textContent = formatTime(this.player.duration);
    const progress = this.element<HTMLInputElement>('progress'); progress.disabled = !this.player.duration; progress.value = String(this.player.duration ? this.player.currentTime / this.player.duration * 1000 : 0); progress.style.setProperty('--progress', `${Number(progress.value) / 10}%`);
    this.element<HTMLInputElement>('volume').value = String(Math.round(this.player.volume * 100)); this.element('volume-value').textContent = `${Math.round(this.player.volume * 100)} %`;
    this.element<HTMLSelectElement>('repeat').value = (this.player.playlist ?? this.playlists.active).repeatMode;
    this.root.querySelectorAll<HTMLElement>('.track-row').forEach(row => row.classList.toggle('selected', row.dataset.songId === song?.id));
    if (song) { const duration = this.root.querySelector(`[data-duration-id="${song.id}"]`); if (duration) duration.textContent = song.duration ? formatTime(song.duration) : '—'; }
    if (!this.element('structure').hidden) this.renderStructure();
  }
  private renderStructure(): void {
    const panel = this.element('structure'); if (panel.hidden) return;
    const list = this.playlists.active.songs;
    const snapshots = list.readSnapshot();
    const signature=JSON.stringify([snapshots,this.inspectedNode,this.editor.lastOperation,this.playlists.active.name,this.academicMode]);
    if (signature===this.structureSignature) return; this.structureSignature=signature;
    const title = (id: string | null): string => id ? escapeHtml(list.getAt(list.indexOf(id)).title) : 'Sin conexión';
    const selected = snapshots.find(node=>node.id===this.inspectedNode) ?? snapshots.find(node=>node.isCurrent);
    panel.innerHTML = `<h3>Visualizador de lista doble</h3><label><input id="academic-mode" type="checkbox" ${this.academicMode?'checked':''}> Modo de demostración académica</label><p id="operation-explanation" ${this.academicMode?'':'hidden'}>${escapeHtml(this.editor.lastOperation)}</p><div class="node-chain"><span>∅</span>${snapshots.map(node=>`<span aria-hidden="true">⇄</span><button class="node ${node.isCurrent?'current-node':''}" data-action="inspect-node" data-id="${node.id}">${node.isHead?'<small>Inicio</small>':''}${title(node.id)}${node.isTail?'<small>Final</small>':''}${node.isCurrent?'<small>Actual</small>':''}</button>`).join('')}<span>⇄ ∅</span></div>${!snapshots.length?'<p>Lista vacía: inicio, final y actual están vacíos.</p>':''}<p>${list.getSize()} nodos · Posiciones desde 1</p>${selected?`<div class="node-details"><strong>${title(selected.id)}</strong><span>Anterior: ${title(selected.previousId)}</span><span>Siguiente: ${title(selected.nextId)}</span><span>Posición: ${selected.index+1}</span></div>`:''}`;
  }
  private message(message: string, error = false): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    const toast = this.element('toast'); toast.textContent = message; toast.classList.toggle('toast-error', error); toast.hidden = false;
    this.messageTimer = setTimeout(() => { toast.hidden = true; }, 6500);
  }
}
