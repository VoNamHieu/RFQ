# RFQ × B2B

QuoteSnap RFQ × Shopify B2B — the *create-company* flow prototype. A single, self-contained
static page (`index.html`): no build step, no dependencies, no backend.

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
