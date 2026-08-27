# RFQ × B2B

QuoteSnap RFQ × Shopify B2B — the *create-company* flow prototype. A self-contained
static page (`index.html`): no build step, no backend.

## Design tokens (Shopify Polaris)

The stylesheets are driven by the real Polaris design system. `vendor/polaris-tokens.css`
is the vendored `@shopify/polaris-tokens@9.4.2` CSS build (the `--p-*` custom properties)
and serves as the **source of record**. Both `index.html` and `b2b/index.html` **inline a
copy** of that file in a `<style>` block at the top of their `<head>`, then reference the
`--p-*` tokens for colors, spacing and radii. `b2b/index.html` additionally keeps the two
tokens that intentionally differ from the library (`--p-color-input-border-top`, and
`--p-font-family-mono` for IBM Plex Mono).

Tokens are **inlined, not `<link>`ed on purpose**: these pages are opened straight from
`file://` (and embedded in other contexts), where an external stylesheet at a relative path
often doesn't load — which would leave every `--p-*` undefined and collapse the whole layout.
Inlining keeps each page fully self-contained.

To update the tokens: refresh `vendor/polaris-tokens.css` (bump the version in its header
URL and re-download), then re-inline it into both HTML files (replace the contents of each
page's first `<style>` block). Full Polaris *components* (`@shopify/polaris`) are React-only
and intentionally not used here.

## Local preview

```bash
npm run dev
# or, without installing anything:
npx serve .
```

Then open the printed URL (usually http://localhost:3000). You can also just double-click
`index.html` — it runs straight from the file system.

## Deploy to Vercel

Because it's static, there is **no build command** and **no output directory** — Vercel serves
`index.html` directly.

### Option A — GitHub + Vercel dashboard (recommended)

1. Push this folder to a GitHub repo (see below).
2. In Vercel: **Add New… → Project → Import** the repo.
3. Settings when importing:
   - **Framework Preset:** `Other`
   - **Root Directory:** the folder that contains this `index.html`
     (`rfq-x-b2b` if you pushed the whole `Quotesnap B2B` repo; `./` if this folder is the repo root)
   - **Build Command:** *(leave empty)*
   - **Output Directory:** *(leave empty)*
4. **Deploy.** Every future `git push` redeploys automatically.

### Option B — Vercel CLI

```bash
npm i -g vercel
cd rfq-x-b2b
vercel          # preview deploy
vercel --prod   # production deploy
```

## Push to GitHub

If you want this folder to be its **own** repository:

```bash
cd rfq-x-b2b
git init
git add .
git commit -m "RFQ x B2B prototype"
git branch -M main
git remote add origin https://github.com/<you>/rfq-x-b2b.git
git push -u origin main
```

Otherwise, commit it as part of the existing `Quotesnap B2B` repo and set Vercel's **Root
Directory** to `rfq-x-b2b`.

## Note on the source file

`index.html` here is a copy of `../RFQ x B2B.html`. Going forward, edit **this** file
(`rfq-x-b2b/index.html`) as the deployable source, or keep the two in sync.
