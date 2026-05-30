import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Use app.html as entry so marketing index.html can be copied in at build time
    // without conflict. Netlify rewrites /signup, /intake, /dashboard/* → /app.html.
    rollupOptions: {
      input: 'app.html',
    },
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/snapshot': 'http://localhost:8080',
      '/create-checkout-session': 'http://localhost:8080',
      '/stripe-webhook': 'http://localhost:8080',
    },
  },
});
