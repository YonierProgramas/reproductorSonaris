export class PwaService extends EventTarget {
  ready=false;
  status=import.meta.env.PROD?'Recursos sin conexión pendientes de preparar.':'El modo sin conexión se prepara en la compilación de producción.';
  async prepare(): Promise<void> {
    if(!import.meta.env.PROD)throw new Error('Production build required');
    if(!('serviceWorker' in navigator) || !window.isSecureContext)throw new Error('Service worker unavailable');
    const base=new URL(import.meta.env.BASE_URL,location.href);
    const existing=await navigator.serviceWorker.getRegistration(base.href);
    if(!navigator.onLine && existing?.active?.state==='activated'){this.markReady();return;}
    const registration=await navigator.serviceWorker.register(new URL('service-worker.js',base),{scope:base.pathname});
    await new Promise<void>((resolve,reject)=>{
      if(!registration.installing && !registration.waiting && registration.active?.state==='activated'){resolve();return;}
      const worker=registration.installing??registration.waiting??registration.active;
      if(!worker){reject(new Error('No worker available'));return;}
      const timeout=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(new Error('Offline preparation timed out'));},15000);
      const check=()=>{if(worker.state==='activated'){clearTimeout(timeout);worker.removeEventListener('statechange',check);resolve();}else if(worker.state==='redundant'){clearTimeout(timeout);worker.removeEventListener('statechange',check);reject(new Error('Offline installation failed'));}};
      worker.addEventListener('statechange',check);check();
    });
    this.markReady();
  }
  private markReady():void { this.ready=true;this.status='Recursos preparados para abrir Sonaris sin conexión. Conserva también tus canciones.';this.dispatchEvent(new Event('change'));
  }
}
