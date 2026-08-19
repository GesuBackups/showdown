import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import showdownSrc from './scripts/vite-plugin-showdown-src.mjs';

// Browser test run — the DOM-facing unit specs (formerly the Karma matrix) executed in real
// engines via Vitest browser mode (Playwright). Only test/unit/showdown*.js run here; the CLI
// and fs-based functional suites stay in the Node (jsdom) project.
export default defineConfig({
  plugins: [showdownSrc()],
  test: {
    globals: true,
    setupFiles: ['./test/vitest.setup.mjs'],
    include: ['test/unit/showdown*.js'],
    // *.node-env.js specs assert a bare Node environment (no global window/document);
    // they can't pass in a real browser and belong to the Node (jsdom) project only.
    exclude: ['test/unit/showdown*.node-env.js'],
    // Keep browser-mode failure attachments out of the source tree (test-results/ is gitignored).
    attachmentsDir: 'test-results/attachments',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // On-failure screenshots go under the gitignored test-results/ instead of __screenshots__/.
      screenshotDirectory: 'test-results/screenshots',
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' }
      ]
    }
  }
});
