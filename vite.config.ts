import { defineConfig } from 'vite';

export default defineConfig({
  // Relative resource URLs work at /, /repository-name/, and in a copied static folder.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
  server: { port: 5173, strictPort: true },
});
