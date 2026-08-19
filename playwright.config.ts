import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  webServer: {
    command: 'npm run dev -- --webpack --hostname 127.0.0.1 --port 3115',
    url: 'http://127.0.0.1:3115',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {...process.env, E2E_FIXTURES: '1'},
  },
  use: {baseURL: 'http://127.0.0.1:3115', trace: 'retain-on-failure'},
  projects: [
    {name: 'desktop', use: {viewport: {width: 1440, height: 1000}}},
    {name: 'tablet', use: {viewport: {width: 1024, height: 768}}},
    {name: 'mobile', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}},
  ],
});
