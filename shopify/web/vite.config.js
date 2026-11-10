import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The B2B app's page inside Shopify admin (the qs-b2b-portal app), served at
// /b2b/shopify/ — the app's application_url in ../shopify.app.toml.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        b2bShopify: 'src/b2b/shopify.html',
      },
    },
  },
});
