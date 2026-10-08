import { test, expect } from '@playwright/test';
function wav(name: string, duration = 30) {
  const samples = 8000 * duration, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(Math.sin(i * Math.PI * 440 / 4000) * 1000), 44 + i * 2);
  return { name, mimeType: 'audio/wav', buffer };
}
test('shuffle history, manual priority, mode switching and offline preference use real local audio', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/'); await page.getByRole('button', { name: 'Seleccionar archivos', exact: true }).click(); await page.locator('#audio-files').setInputFiles(['A','B','C','D'].map(name => wav(name + '.wav')));
  await page.getByRole('button', { name: 'Reproducir A', exact: true }).click(); await expect(page.locator('#current-time')).not.toHaveText('00:00'); const time = await page.locator('#current-time').textContent();
  await page.locator('#repeat').selectOption('shuffle'); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo'); await expect(page.locator('#now-title')).toHaveText('A'); const seconds = (value: string) => value.split(':').reduce((total, part) => total * 60 + Number(part), 0); expect(seconds((await page.locator('#current-time').textContent())!)).toBeGreaterThanOrEqual(seconds(time!));
  await page.locator('#next').click(); await expect(page.locator('#now-title')).toHaveText('D'); await page.locator('#next').click(); await expect(page.locator('#now-title')).toHaveText('C');
  await page.locator('#previous').click(); await expect(page.locator('#now-title')).toHaveText('D'); await page.locator('#previous').click(); await expect(page.locator('#now-title')).toHaveText('A'); await expect(page.locator('#previous')).toBeDisabled();
  await page.locator('#next').click(); await expect(page.locator('#now-title')).toHaveText('D'); await page.locator('#next').click(); await expect(page.locator('#now-title')).toHaveText('C');
  await page.locator('.track-row').nth(1).locator('summary').click(); await page.getByRole('button',{name:'Reproducir a continuación',exact:true}).click(); await page.locator('#next').click(); await expect(page.locator('#now-title')).toHaveText('B'); await expect(page.locator('#next')).toBeDisabled();
  await page.locator('#previous').click(); await expect(page.locator('#now-title')).toHaveText('C'); await page.locator('#next').click(); await expect(page.locator('#now-title')).toHaveText('B'); await expect(page.locator('.track-title strong')).toHaveText(['A','B','C','D']);
  for (const mode of ['one','all','normal','shuffle']) { await page.locator('#repeat').selectOption(mode); await expect(page.locator('#now-title')).toHaveText('B'); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo'); }
  await page.getByRole('tab',{name:'Sin conexión',exact:true}).click(); await page.getByRole('button',{name:'Conservar canciones de esta playlist',exact:true}).click(); await expect(page.locator('#offline-status')).toContainText('Canciones conservadas'); await page.reload(); await expect(page.locator('#repeat')).toHaveValue('shuffle'); await expect(page.locator('.track-title strong')).toHaveText(['A','B','C','D']); await expect(page.locator('#now-title')).toHaveText('B'); expect(errors).toEqual([]);
});
test('shuffle ends a single cycle without duplicate automatic plays and can explicitly restart', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; }); await page.goto('/'); await page.getByRole('button',{name:'Seleccionar archivos',exact:true}).click(); await page.locator('#audio-files').setInputFiles(['A','B','C'].map(name => wav(name+'.wav',2)));
  await page.locator('#repeat').selectOption('shuffle'); await page.getByRole('button',{name:'Reproducir A',exact:true}).click(); await expect(page.locator('#now-title')).toHaveText('C',{timeout:10000}); await expect(page.locator('#now-title')).toHaveText('B',{timeout:10000}); await expect(page.locator('#playback-status')).toHaveText('Ciclo aleatorio terminado',{timeout:10000}); await expect(page.locator('#next')).toBeDisabled(); await expect(page.locator('#previous')).toBeEnabled();
  await page.locator('#play').click(); await expect(page.locator('#playback-status')).toHaveText('Reproduciendo'); await expect(page.locator('#next')).toBeEnabled();
});
