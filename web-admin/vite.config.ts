import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  // Load .env from the monorepo root so all VITE_ vars live in one place.
  // Only VITE_-prefixed vars are exposed to the browser bundle.
  // fileURLToPath handles Windows drive letters correctly (avoids leading-slash bug).
  envDir: path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
