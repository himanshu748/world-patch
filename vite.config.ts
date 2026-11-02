import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/public', emptyOutDir: true, chunkSizeWarningLimit: 1600 },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000', '/auth': 'http://127.0.0.1:3000', '/ws': { target: 'ws://127.0.0.1:3000', ws: true } } }
});
