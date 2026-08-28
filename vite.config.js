import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Multi-page build: the RFQ app and the B2B app are separate entry HTML files.
// During development they are served under /src/rfq/ and /src/b2b/. The final
// swap to root (/) and /b2b/ happens once the React apps reach parity with the
// legacy god files (which stay live until then).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        rfq: 'src/rfq/index.html',
        b2b: 'src/b2b/index.html',
      },
    },
  },
});
