import {test,expect} from '@playwright/test';
function wav(name:string,duration=12){const rate=8000,samples=rate*duration,buffer=Buffer.alloc(44+samples*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*440)*3000),44+i*2);return {name,mimeType:'audio/wav',buffer};}
test('real analysis, equalizer, linked drag, queue, statistics, undo and sleep timer',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const Base=window.AudioContext;
    const audit={contexts:0,sources:0,filters:0,reads:0,peak:0};Object.assign(window,{audioAudit:audit});
    class AuditedContext extends Base{
      constructor(){super();audit.contexts++;}
      override createMediaElementSource(element:HTMLMediaElement){audit.sources++;return super.createMediaElementSource(element);}
      override createBiquadFilter(){audit.filters++;return super.createBiquadFilter();}
      override createAnalyser(){const analyser=super.createAnalyser();const read=analyser.getByteFrequencyData.bind(analyser);analyser.getByteFrequencyData=(data)=>{read(data);audit.reads++;audit.peak=Math.max(audit.peak,...data);};return analyser;}
    }
    window.AudioContext=AuditedContext;
  });
  await page.goto('/');await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click();await page.locator('#audio-files').setInputFiles([wav('Alpha.wav'),wav('Beta.wav'),wav('Gamma.wav')]);
  await page.getByRole('button',{name:'Reproducir Alpha',exact:true}).click();await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
  await page.locator('.track-row').nth(0).dragTo(page.locator('.track-row').nth(2));await expect(page.locator('.track-title strong')).toHaveText(['Beta','Gamma','Alpha']);await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
  await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('.track-title strong')).toHaveText(['Alpha','Beta','Gamma']);await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect(page.locator('.track-title strong')).toHaveText(['Beta','Gamma','Alpha']);
  await page.locator('.track-row').nth(1).locator('summary').click();await page.getByRole('button',{name:'Reproducir a continuación',exact:true}).click();await page.getByRole('tab',{name:/Cola/}).click();await expect(page.locator('.queue-row strong')).toHaveText('Gamma');
  await page.getByRole('button',{name:'Canción siguiente'}).click();await expect(page.locator('#now-title')).toHaveText('Gamma');await expect(page.locator('.queue-row')).toHaveCount(0);
  await page.getByRole('tab',{name:'Audio',exact:true}).click();await page.getByRole('button',{name:'Activar visualizador',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>((window as unknown as {audioAudit:{peak:number}}).audioAudit.peak))).toBeGreaterThan(0);
  await page.locator('#visualization-mode').selectOption('wave');await page.locator('#equalizer-preset').selectOption('rock');await expect(page.locator('#value-bass')).toHaveText('+3 dB');await page.locator('#band-mid').fill('4');await expect(page.locator('#equalizer-preset')).toHaveValue('custom');await page.getByRole('button',{name:'Restablecer',exact:true}).click();await expect(page.locator('#value-mid')).toHaveText('0 dB');
  expect(await page.evaluate(()=>{const {contexts,sources,filters}=(window as unknown as {audioAudit:{contexts:number;sources:number;filters:number}}).audioAudit;return {contexts,sources,filters};})).toEqual({contexts:1,sources:1,filters:3});
  await page.getByRole('tab',{name:'Mis estadísticas',exact:true}).click();await page.locator('#stats-threshold').fill('1');await page.locator('#stats-threshold').dispatchEvent('change');await expect(page.locator('#stats-total')).not.toHaveText('0');await expect(page.locator('#stats-minutes')).not.toHaveText('0');
  await page.getByRole('tab',{name:'Temporizador',exact:true}).click();await page.locator('#sleep-duration').selectOption('custom');await page.locator('#sleep-custom').fill('0.02');await page.getByRole('button',{name:'Iniciar temporizador',exact:true}).click();await expect(page.locator('#sleep-remaining')).toHaveText('Sin temporizador',{timeout:10000});await expect(page.locator('#playback-status')).toHaveText('Sin reproducción');await expect(page.locator('#volume-value')).toHaveText('65 %');
  await page.getByRole('button',{name:'Atajos de teclado',exact:true}).click();await expect(page.locator('#shortcuts-dialog')).toBeVisible();await page.getByRole('button',{name:'Cerrar ayuda',exact:true}).click();await page.locator('body').evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await page.keyboard.press('m');await expect(page.locator('#volume-value')).toHaveText('0 %');await page.keyboard.press('m');await expect(page.locator('#volume-value')).toHaveText('65 %');
  await page.screenshot({path:'test-results/advanced-desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('authorized audio survives reload and application works offline with service worker',async({page,context})=>{
  test.skip(process.env.SONARIS_PRODUCTION_TEST!=='1','Offline shell requires a production build');
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click();await page.locator('#audio-files').setInputFiles([wav('Saved.wav'),wav('Temporary.wav')]);
  await page.getByRole('tab',{name:'Sin conexión',exact:true}).click();await page.getByRole('button',{name:'Preparar modo sin conexión',exact:true}).click();await expect(page.locator('#cache-status')).toContainText('Recursos preparados');
  await page.locator('#saved-files').getByRole('button',{name:'Conservar sin conexión',exact:true}).first().click();await expect(page.locator('#offline-status')).toContainText('Canciones conservadas');
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);await page.reload();await expect(page.locator('.track-title strong')).toHaveText('Saved');await expect(page.locator('#play')).toBeEnabled();await page.getByRole('button',{name:'Reproducir Saved',exact:true}).click();await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');await expect(page.locator('#duration')).toHaveText('00:12');
  await page.getByRole('button',{name:'Pausar',exact:true}).click();await page.getByRole('tab',{name:'Sin conexión',exact:true}).click();await expect(page.locator('#offline-status')).toContainText('1 archivos no estaban conservados');
  await page.getByRole('button',{name:'Eliminar archivo guardado',exact:true}).click();await expect(page.locator('#offline-status')).toContainText('Archivos eliminados');await page.reload();await expect(page.locator('.track-row')).toHaveCount(0);
  const manifest=await page.evaluate(async()=>await (await fetch('./manifest.webmanifest')).json() as {name:string;display:string});expect(manifest.display).toBe('standalone');expect(manifest.name).toContain('Sonaris');expect(errors).toEqual([]);
});
test('advanced mobile panels have no horizontal overflow and tab keyboard navigation works',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('tab',{name:'Audio',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:/Cola/})).toBeFocused();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'Sin conexión',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const activeBounds=await page.getByRole('tab',{name:'Sin conexión',exact:true}).boundingBox();const stripBounds=await page.locator('.feature-tabs').boundingBox();expect(activeBounds!.x+activeBounds!.width).toBeLessThanOrEqual(stripBounds!.x+stripBounds!.width+1);await page.screenshot({path:'test-results/advanced-mobile.png',fullPage:true});
});
