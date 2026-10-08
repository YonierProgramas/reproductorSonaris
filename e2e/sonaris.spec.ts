import { test, expect } from '@playwright/test';
// Generated PCM data exercises real browser audio without bundling demo songs.
function wav(name: string, duration = 2) {
  const rate = 8000; const samples = rate * duration; const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF',0); data.writeUInt32LE(data.length - 8,4); data.write('WAVE',8); data.write('fmt ',12); data.writeUInt32LE(16,16); data.writeUInt16LE(1,20); data.writeUInt16LE(1,22); data.writeUInt32LE(rate,24); data.writeUInt32LE(rate * 2,28); data.writeUInt16LE(2,32); data.writeUInt16LE(16,34); data.write('data',36); data.writeUInt32LE(samples * 2,40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin(i / rate * Math.PI * 2 * 440) * 1000),44 + i * 2);
  return { name, mimeType: 'audio/wav', buffer: data };
}
test('real audio, linked operations, playlists, clones, effects and persistence', async ({page}) => {
  const errors: string[] = []; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('heading',{name:'Favoritas',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click();
  await page.locator('#audio-files').setInputFiles([wav('Alpha.wav',5),wav('Beta.wav',5)]);
  await expect(page.locator('.track-title strong')).toHaveText(['Alpha','Beta']);
  await page.locator('#placement').selectOption('first'); await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click(); await page.locator('#audio-files').setInputFiles(wav('Start.wav',5));
  await page.locator('#placement').selectOption('position'); await page.locator('#position').fill('3'); await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click(); await page.locator('#audio-files').setInputFiles(wav('Middle.wav',5));
  await expect(page.locator('.track-title strong')).toHaveText(['Start','Alpha','Middle','Beta']);
  await page.locator('#position').fill('99'); await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click(); await expect(page.locator('#toast')).toContainText('entre 1 y 5');
  await page.getByRole('button',{name:'Reproducir Alpha',exact:true}).click();
  await expect(page.locator('#playback-status')).toHaveText('Reproduciendo'); await expect(page.locator('#duration')).toHaveText('00:05');
  await expect(page.locator('#current-time')).not.toHaveText('00:00');
  await page.getByRole('button',{name:'Pausar',exact:true}).click(); await expect(page.locator('#playback-status')).toHaveText('En pausa');
  await page.locator('#progress').fill('500'); await expect(page.locator('#current-time')).toHaveText('00:02');
  await page.getByRole('button',{name:'Canción siguiente'}).click(); await expect(page.locator('#now-title')).toHaveText('Middle');
  await page.getByRole('button',{name:'Canción anterior'}).click(); await expect(page.locator('#now-title')).toHaveText('Alpha');
  await page.locator('#volume').fill('40'); await page.locator('#boost').check(); await page.locator('#fade').check();
  await expect(page.locator('#volume-value')).toHaveText('40 %'); await page.getByRole('button',{name:'Reproducir',exact:true}).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
  await page.getByRole('button',{name:'Pausar',exact:true}).click();
  await page.getByRole('button',{name:'Duplicar playlist',exact:true}).click(); await expect(page.getByRole('heading',{name:'Favoritas (copia)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Eliminar Alpha',exact:true}).click(); await expect(page.locator('.track-title strong')).toHaveText(['Start','Middle','Beta']);
  await page.locator('.playlist-item').filter({hasText:'Favoritas'}).first().click(); await expect(page.locator('.track-title strong')).toHaveText(['Start','Alpha','Middle','Beta']);
  await page.getByRole('button',{name:'Ver cómo funciona',exact:true}).click(); await expect(page.locator('.node')).toHaveCount(4); await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Nueva playlist',exact:true}).click(); await page.locator('#playlist-name').fill('   '); await page.getByRole('button',{name:'Crear playlist',exact:true}).click(); await expect(page.locator('#dialog-error')).toContainText('nombre válido');
  await page.locator('#playlist-name').fill('Estudio'); await page.locator('#description').fill('Música para aprender'); await page.getByRole('button',{name:'Crear playlist',exact:true}).click(); await expect(page.getByRole('heading',{name:'Estudio',exact:true})).toBeVisible(); await expect(page.locator('#play')).toBeDisabled();
  await page.getByRole('button',{name:'Renombrar',exact:true}).click(); await page.locator('#playlist-name').fill('Universidad'); await page.getByRole('button',{name:'Guardar nombre',exact:true}).click();
  await page.locator('#repeat').selectOption('all'); await page.reload(); await expect(page.locator('.playlist-item')).toHaveCount(3); await page.locator('.playlist-item').filter({hasText:'Universidad'}).click(); await expect(page.locator('#repeat')).toHaveValue('all'); await expect(page.locator('.track-row')).toHaveCount(0);
  await page.getByRole('button',{name:'Eliminar playlist',exact:true}).click(); await page.locator('#dialog-submit').click(); await expect(page.locator('.playlist-item')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('real ended events implement all three playback modes and removal safely stops audio', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click(); await page.locator('#audio-files').setInputFiles([wav('First.wav'),wav('Last.wav')]);
  await page.getByRole('button',{name:'Reproducir First',exact:true}).click(); await expect(page.locator('#now-title')).toHaveText('Last',{timeout:10000}); await expect(page.locator('#playback-status')).toHaveText('En pausa',{timeout:10000});
  await page.locator('#repeat').selectOption('all'); await page.getByRole('button',{name:'Reproducir Last',exact:true}).click(); await expect(page.locator('#now-title')).toHaveText('First',{timeout:10000});
  await page.getByRole('button',{name:'Pausar',exact:true}).click(); await page.locator('#repeat').selectOption('one'); await page.getByRole('button',{name:'Reproducir First',exact:true}).click(); await page.waitForTimeout(2500); await expect(page.locator('#now-title')).toHaveText('First'); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo');
  await page.getByRole('button',{name:'Eliminar First',exact:true}).click(); await expect(page.locator('#now-title')).toHaveText('Last'); await expect(page.locator('#playback-status')).toHaveText('En pausa');
  await page.getByRole('button',{name:'Eliminar Last',exact:true}).click(); await expect(page.locator('#play')).toBeDisabled(); await expect(page.locator('#previous')).toBeDisabled(); await expect(page.locator('#next')).toBeDisabled();
});
test('mobile layout and keyboard controls remain usable', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await expect(page.getByRole('button',{name:'Nueva playlist',exact:true})).toBeVisible(); await expect(page.getByRole('button',{name:'Seleccionar archivos',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Nueva playlist',exact:true}).focus(); await page.keyboard.press('Enter'); await expect(page.locator('#playlist-dialog')).toBeVisible(); await page.keyboard.type('Móvil'); await page.keyboard.press('Enter'); await expect(page.getByRole('heading',{name:'Móvil',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('decoding errors are visible and cloned audio survives deleting the original playlist', async ({page}) => {
  const errors: string[] = []; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/'); await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click();
  await page.locator('#audio-files').setInputFiles([{name:'Broken.wav',mimeType:'audio/wav',buffer:Buffer.from('not an audio file')},wav('Valid.wav',5)]);
  await page.getByRole('button',{name:'Reproducir Broken',exact:true}).click(); await expect(page.locator('#playback-status')).toHaveText('Archivo no reproducible'); await expect(page.locator('#toast')).toContainText('No se pudo reproducir');
  await page.getByRole('button',{name:'Duplicar playlist',exact:true}).click(); await page.locator('.playlist-item').first().click();
  await page.getByRole('button',{name:'Eliminar playlist',exact:true}).click(); await page.locator('#dialog-submit').click();
  await page.getByRole('button',{name:'Reproducir Valid',exact:true}).click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo'); await expect(page.locator('#duration')).toHaveText('00:05');
  await page.getByRole('button',{name:'Pausar',exact:true}).click(); expect(errors).toEqual([]);
});
