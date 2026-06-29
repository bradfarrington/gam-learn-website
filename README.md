# GamLEARN Website — Self-Hosted Clone

A pixel-for-pixel, fully self-hosted static clone of **gamlearn.org.uk** (originally built in Framer).
Every asset — HTML, JavaScript bundles, fonts, images, videos and CMS data — is bundled into this
repo. **There are no references to Framer or its CDN anywhere in the code**, so the site runs entirely
on its own and the Framer subscription can be cancelled.

All animations (scroll/appear animations, animated counters, hover effects, etc.) are preserved because
the original Framer/`motion` JavaScript bundles are included and run locally.

## What's in here

| Path | Description |
|------|-------------|
| `index.html`, `*.html` | The rendered pages (home, about, services, blog index, forms, policies). Clean URLs — e.g. `/about-us`. |
| `blog/_post-template.html` | Shared, **DB-driven** template for every blog post. `/blog/<slug>` resolves here (via the `vercel.json` rewrite) and `_assets/blog-posts.js` fills the title/hero/body live from the Supabase `blog_posts` table. Posts are managed entirely in the CRM — there are no per-post HTML files. |
| `_assets/fu/sites/…` | The JavaScript module bundle graph (React + motion) that powers layout & animations. |
| `_assets/fu/images/…` | All images & SVGs. |
| `_assets/fu/assets/…`, `_assets/fu/gstatic/…` | Self-hosted fonts (woff2). |
| `_assets/fu/modules/…` | The CMS data files (`.framercms`) for the blog, rewritten to point at local assets. |
| `c/…` | Blog (CMS) images & video, extracted from the CMS data. |
| `vercel.json` | Hosting config: clean URLs, no trailing slash, long-cache headers for `/_assets`. |
| `sitemap.xml`, `robots.txt` | SEO files (point at the gamlearn.org.uk domain). |
| `tools/scripts/` | The pipeline used to build this clone (kept for reference / re-running). |
| `raw/` | Untouched HTML captured from the live site (git-ignored; intermediate only). |

## Run locally

```bash
npm start          # serves the site at http://localhost:4321
```

The dev server (`tools/scripts/serve.mjs`) replicates the production routing exactly
(clean URLs, no trailing slash, HTTP range requests).

## Deploy

This is a **plain static site** — the repo root *is* the web root. It works on any static host
(Vercel, Netlify, Cloudflare Pages, S3+CloudFront, nginx, etc.). Two important rules the included
`vercel.json` already enforces and any other host must match:

- **Clean URLs** — serve `about-us.html` at `/about-us`.
- **No trailing slash** — the in-page navigation links resolve relative to the clean URL.

### Vercel
```bash
vercel deploy          # preview
vercel deploy --prod   # production
```
No build step, no framework — Vercel serves it as static. Then point the `gamlearn.org.uk` domain at
the Vercel project (Project → Settings → Domains) and the Framer plan can be cancelled.

### Other hosts
Enable "clean URLs / strip `.html` extension" and disable "add trailing slash". Upload everything
except `raw/` and `tools/`.

## De-Framered — what was removed

- **Zero external references to Framer.** No requests to `framer.com`, `framerusercontent.com`,
  `api.framer.com`, `events.framer.com`, or `fonts.gstatic.com` — verified by live network capture
  on all 45 pages. Nothing needs a Framer account; cancelling Framer changes nothing.
- All Framer branding/metadata removed ("Made in Framer", `generator`, `framer-search-index`,
  `framer-html-plugin` metas).
- The 3 native Framer **forms are disabled** (display-only). The working **GoHighLevel** forms
  (referral / membership) are separate embedded iframes and still function. The contact + newsletter
  forms can be re-pointed to a real backend whenever you want.
- **Internal identifiers renamed**: every `framer-*` CSS class and `data-framer-*` attribute was
  renamed to `glearn-*` / `data-glearn-*` (288k replacements, applied consistently across HTML + JS).
  The only remaining "framer" substrings are unrelated library terms (`keyframeResolver`,
  `forceFrameRate`).

## External services kept (not Framer)

- **GoHighLevel** form iframes (`api.leadconnectorhq.com`, `link.thedigicraft.co.uk`) — referral &
  membership forms, unchanged.
- **Review widget** from `reputationhub.site` — unchanged.
- Outbound links in blog articles point to their original destinations.

## How the clone was built

The `tools/scripts/` pipeline (run in order) mirrored the live site and de-Framered it:

1. `1-fetch-pages.mjs` — download all 45 pages from the sitemap.
2. `2-collect-assets.mjs` / `3-download-assets.mjs` — crawl & download the full JS module graph + images.
3. `4`/`5-*module-assets.mjs` — download fonts & assets embedded inside the JS bundles.
4. `6-rewrite.mjs` — rewrite every `framerusercontent.com` URL to a local path, rewrite nav links to
   absolute, strip Framer analytics/editor/branding.
5. `7-fix-runtime.mjs` — patch the CMS loader for static hosting + add a `URL` resolver shim.
6. `8-localize-cms.mjs` — localize image/video URLs embedded in the binary `.framercms` CMS data
   (length-preserving) and neutralize the Framer editor bundle.
