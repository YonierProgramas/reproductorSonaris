import type { AudioPlayerService } from './AudioPlayerService';
import type { PlaylistEditor } from './PlaylistEditor';
export const keyboardShortcuts: readonly [string,string][] = [
  ['Espacio','Reproducir o pausar'],['→ / ←','Avanzar o retroceder cinco segundos'],['Ctrl + → / ←','Siguiente o anterior'],['↑ / ↓','Subir o bajar volumen'],['M','Silenciar o activar sonido'],['Ctrl + Z','Deshacer'],['Ctrl + Y / Ctrl + Mayús + Z','Rehacer'],
];
export class KeyboardShortcutService {
  private previousVolume=.65;
  private readonly listener=(event: KeyboardEvent)=>this.handle(event);
  constructor(private readonly player: AudioPlayerService,private readonly editor: PlaylistEditor, private readonly enabled: () => boolean = () => true) { document.addEventListener('keydown',this.listener); }
  private handle(event: KeyboardEvent): void {
    if(!this.enabled() || event.defaultPrevented || event.isComposing || event.altKey || event.metaKey || document.querySelector('dialog[open]'))return;
    const target=event.target;
    if(target instanceof HTMLElement && target.closest('input,textarea,select,button,a,summary,[contenteditable],[role="tab"],[role="slider"]'))return;
    const key=event.key.toLowerCase();let action: (()=>void)|null=null;
    if(event.ctrlKey){
      if(key==='z')action=()=>event.shiftKey?this.editor.redo():this.editor.undo();
      else if(key==='y' && !event.shiftKey)action=()=>this.editor.redo();
      else if(key==='arrowright' && !event.shiftKey)action=()=>{void this.player.next();};
      else if(key==='arrowleft' && !event.shiftKey)action=()=>{void this.player.previous();};
    }else if(!event.shiftKey){
      if(key===' ')action=()=>{if(this.player.state==='playing'||this.player.state==='loading')this.player.pause();else void this.player.play();};
      else if(key==='arrowright')action=()=>this.player.skipSeconds(5);
      else if(key==='arrowleft')action=()=>this.player.skipSeconds(-5);
      else if(key==='arrowup')action=()=>this.player.setVolume(this.player.volume+.05);
      else if(key==='arrowdown')action=()=>this.player.setVolume(this.player.volume-.05);
      else if(key==='m')action=()=>{if(this.player.volume>0){this.previousVolume=this.player.volume;this.player.setVolume(0);}else this.player.setVolume(this.previousVolume);};
    }
    if(action){event.preventDefault();action();}
  }
  dispose(): void {document.removeEventListener('keydown',this.listener);}
}
