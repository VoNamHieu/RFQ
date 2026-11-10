// Post-build: move the app page to /b2b/shopify/ and give each section a page of
// its own (the same app page), so a section's link works on reload with no
// rewrites (src/b2b/shopifyRoutes.js). Asset URLs in the built HTML are absolute
// (/assets/...), so moving the HTML does not break them.
import { rename, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SHOPIFY_SECTION_PATHS } from '../src/b2b/shopifyRoutes.js';

const dist = new URL('../dist/', import.meta.url);

await mkdir(new URL('b2b/shopify/', dist), { recursive: true });
await rename(new URL('src/b2b/shopify.html', dist), new URL('b2b/shopify/index.html', dist));
for (const section of SHOPIFY_SECTION_PATHS) {
  await mkdir(new URL(`b2b/shopify/${section}/`, dist), { recursive: true });
  await cp(new URL('b2b/shopify/index.html', dist), new URL(`b2b/shopify/${section}/index.html`, dist));
}
await rm(new URL('src', dist), { recursive: true, force: true });

console.log('postbuild: dist/b2b/shopify/ ready at', fileURLToPath(dist));
