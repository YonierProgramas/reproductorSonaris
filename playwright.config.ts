import { defineConfig } from '@playwright/test';
const production=process.env.SONARIS_PRODUCTION_TEST==='1';
const address=production?'http://127.0.0.1:4173':'http://127.0.0.1:5173';
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: { baseURL: address, headless: true, screenshot: 'only-on-failure' },
  webServer: { command: production?'npm run preview -- --host 127.0.0.1':'npm run dev -- --host 127.0.0.1', url: address, reuseExistingServer: false },
});
