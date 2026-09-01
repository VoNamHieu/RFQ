// Post-build: reshape the Vite multi-page output for production hosting so the
// React apps serve at clean paths and the god files are retired:
//   dist/src/rfq/index.html -> dist/index.html        (served at /)
//   dist/src/b2b/index.html -> dist/b2b/index.html    (served at /b2b/)
// and copy the static version snapshots + manifest so the in-app version switcher
// (which fetches /versions/manifest.json and links the changelog at /versions/)
// keeps working. Asset URLs in the built HTML are absolute (/assets/...), so
// moving the HTML does not break them.
import { rename, mkdir, rm, cp, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const versionsSrc = new URL('../versions/', import.meta.url);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

await mkdir(new URL('b2b/', dist), { recursive: true });
await rename(new URL('src/rfq/index.html', dist), new URL('index.html', dist));
await rename(new URL('src/b2b/index.html', dist), new URL('b2b/index.html', dist));
await rm(new URL('src', dist), { recursive: true, force: true });

if (await exists(versionsSrc)) {
  await cp(versionsSrc, new URL('versions/', dist), { recursive: true });
}

console.log('postbuild: dist/index.html + dist/b2b/index.html + dist/versions ready at', fileURLToPath(dist));
