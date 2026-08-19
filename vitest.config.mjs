import { defineConfig } from 'vitest/config';
import showdownSrc from './scripts/vite-plugin-showdown-src.mjs';

export default defineConfig({
  plugins: [showdownSrc()],
  test: {
    globals: true,
    setupFiles: ['./test/vitest.setup.mjs'],
    // The CLI suite spawns `node src/cli/cli.js` subprocesses; give it head room.
    testTimeout: 15000,
    projects: [
      {
        // Everything, against an ambient jsdom window/document.
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['test/unit/**/*.js', 'test/functional/**/testsuite.*.js']
        }
      },
      {
        // The makeMarkdown fixtures again with no ambient DOM, so `showdown.helper.document`
        // takes the lazy happy-dom fallback (src/helpers/lazyDocument.js) instead of jsdom's
        // window.document. That branch ships to every Node consumer and is otherwise untested.
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/functional/makemarkdown/testsuite.*.js']
        }
      }
    ]
  }
});
