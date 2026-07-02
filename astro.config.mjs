// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://castles.gg',
  build: {
    // Keep styles in external files: the CSP is `style-src 'self'` with no
    // 'unsafe-inline', so inlined <style> blocks would be refused.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Same reason, for scripts: never inline the canvas module.
      assetsInlineLimit: 0,
    },
  },
});
