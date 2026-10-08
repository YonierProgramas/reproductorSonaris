import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export default defineConfig({
  base:'./',
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[{
    name:'sonaris-offline-shell',
    generateBundle(_options,bundle){
      const assets=[...new Set(['./','./index.html','./manifest.webmanifest','./icon.svg',...Object.keys(bundle).map(name=>'./'+name)])];
      const template=readFileSync(new URL('./src/offline/worker.js',import.meta.url),'utf8');
      const version=createHash('sha256').update(JSON.stringify(assets)+template+readFileSync(new URL('./public/manifest.webmanifest',import.meta.url))+readFileSync(new URL('./public/icon.svg',import.meta.url))).digest('hex').slice(0,12);
      this.emitFile({type:'asset',fileName:'service-worker.js',source:template.replace('__SONARIS_CACHE__',`sonaris-shell-${version}`).replace('__SONARIS_ASSETS__',JSON.stringify(assets))});
    }
  }],
  test:{environment:'jsdom',include:['tests/**/*.test.ts'],maxWorkers:2},
});
