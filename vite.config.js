import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import silverstripePlayground from 'silverstripe-playground/vite';
import tutorials from './bin/tutorials-plugin.js';

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // Relative URLs, so the site also works in a subfolder (e.g. GitHub Pages).
  base: './',
  plugins: [
    // The site bundle: from "npm run bundle", or one built in a checkout of the playground (PLAYGROUND_BUNDLE).
    silverstripePlayground({ bundle: process.env.PLAYGROUND_BUNDLE ?? path('./bundle') }),
    tutorials(path('./tutorials')),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: path('./index.html'), playground: path('./playground.html') },
    },
    // Monaco (the code editor) is one large chunk.
    chunkSizeWarningLimit: 3000,
  },
  server: {
    port: 5420,
  },
});
