import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev convenience: the legacy god-file index.html still lives at the repo root
// (it stays the live production file until the React apps reach parity), so a
// bare `localhost:5173/` would serve the OLD page. This plugin redirects the dev
// root and /b2b to the new Polaris entries so the dev server shows the React UI.
// It only touches the dev server — it has no effect on `vite build`.
function devRootRedirect() {
  return {
    name: 'dev-root-redirect',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/' || url === '/index.html') {
          res.writeHead(302, { Location: '/src/rfq/index.html' });
          return res.end();
        }
        if (url === '/b2b' || url === '/b2b/' || url === '/b2b/index.html') {
          res.writeHead(302, { Location: '/src/b2b/index.html' });
          return res.end();
        }
        next();
      });
    },
  };
}

// Multi-page build: the RFQ app and the B2B app are separate entry HTML files.
// During development they are served under /src/rfq/ and /src/b2b/. The final
// swap to root (/) and /b2b/ happens once the React apps reach parity with the
// legacy god files (which stay live until then).
export default defineConfig({
  plugins: [react(), devRootRedirect()],
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
