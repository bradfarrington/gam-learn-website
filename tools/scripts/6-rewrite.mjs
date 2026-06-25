import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MODDIR = 'site/_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K';

function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function normalize(u) { return u.replace(/&amp;/g, '&').replace(/[`'",;]+$/, ''); }
function localFor(u) {
  const url = new URL(normalize(u));
  let rel;
  if (url.hostname === 'framerusercontent.com') {
    if (url.pathname.startsWith('/images/')) {
      const base = url.pathname.split('/').pop();
      rel = 'fu/images/' + (url.search ? djb2(url.search) + '_' : '') + base;
    } else rel = 'fu' + url.pathname;
  } else if (url.hostname === 'fonts.gstatic.com') {
    rel = 'fu/gstatic' + url.pathname;
  } else return null;
  return '/_assets/' + rel;
}

// ---------- Pass A: collect every referenced fu/gstatic URL, ensure downloaded ----------
async function walk(dir, ext) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}
const htmlFiles = await walk('raw', '.html');
const modFiles = (await readdir(MODDIR)).filter(f => f.endsWith('.mjs')).map(f => join(MODDIR, f));
const assetRe = /https:\/\/(?:framerusercontent\.com|fonts\.gstatic\.com)\/[^\s"'`)<>,]+/g;

const referenced = new Set();
for (const f of [...htmlFiles, ...modFiles]) {
  const txt = await readFile(f, 'utf8');
  for (const m of txt.match(assetRe) || []) referenced.add(normalize(m));
}
console.log('Distinct referenced fu/gstatic URLs:', referenced.size);

// download any missing
async function fetchBuf(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
}
const missing = [];
for (const u of referenced) {
  const web = localFor(u); if (!web) continue;
  const file = join('site', web.replace(/^\/_assets/, '_assets'));
  if (!existsSync(file)) missing.push([u, file]);
}
console.log('Missing files to fetch:', missing.length);
let mc = 0, mfail = [];
await Promise.all(Array.from({ length: 12 }, async () => {
  while (missing.length) {
    const [u, file] = missing.pop();
    try { const b = await fetchBuf(u); await mkdir(dirname(file), { recursive: true }); await writeFile(file, b); mc++; }
    catch (e) { mfail.push([u, e.message]); }
  }
}));
console.log('Fetched missing:', mc, 'failed:', mfail.length);
mfail.slice(0, 20).forEach(([u, e]) => console.log('   FAIL', e, u));

// ---------- shared URL replacer ----------
function replaceAssets(text) {
  return text.replace(assetRe, (m) => {
    const local = localFor(m);
    return local || m;
  });
}

// ---------- Pass B1: rewrite modules in place ----------
let modRewritten = 0;
for (const f of modFiles) {
  let code = await readFile(f, 'utf8');
  const out = replaceAssets(code);
  if (out !== code) { await writeFile(f, out); modRewritten++; }
}
console.log('Modules rewritten:', modRewritten);

// ---------- Pass B2: rewrite HTML pages -> site/ (flat clean-url structure) ----------
function rawToClean(rawPath) {
  // raw/index.html -> '/', raw/about-us/index.html -> '/about-us', raw/blog/x/index.html -> '/blog/x'
  let p = rawPath.replace(/^raw/, '').replace(/\/index\.html$/, '');
  return p === '' ? '/' : p;
}
function cleanToOutFile(clean) {
  if (clean === '/') return 'site/index.html';
  return 'site' + clean + '.html';
}

function stripFramer(html) {
  html = html.replace(/<!--\s*Made in Framer[\s\S]*?-->/g, '');
  html = html.replace(/<!--\s*Published[\s\S]*?-->/g, '');
  html = html.replace(/<meta name="generator" content="Framer[^"]*">/g, '');
  // analytics beacon
  html = html.replace(/<script async src="https:\/\/events\.framer\.com[^>]*><\/script>/g, '');
  // editor-bar preload probe
  html = html.replace(/<script>try\{if\(localStorage\.getItem\("__framer_force_showing_editorbar_since"\)[\s\S]*?<\/script>/g, '');
  // any stray framer.com edit url
  html = html.replace(/https:\/\/framer\.com\/edit\/init\.mjs/g, '');
  return html;
}

function rewriteNavLinks(html, clean) {
  const base = 'https://h' + clean;
  // href="./..." or href="../..." or href="./" etc.
  return html.replace(/href="(\.\.?\/[^"]*|\.\.?)"/g, (m, rel) => {
    try { const abs = new URL(rel, base).pathname; return `href="${abs}"`; }
    catch { return m; }
  });
}

let pages = 0;
for (const f of htmlFiles) {
  const clean = rawToClean(f);
  let html = await readFile(f, 'utf8');
  html = stripFramer(html);
  html = replaceAssets(html);              // handles &amp; via normalize
  // also catch &amp;-encoded asset urls that assetRe split (it stops at nothing problematic; &amp; has no special char) -> already fine
  html = rewriteNavLinks(html, clean);
  const outFile = cleanToOutFile(clean);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
  pages++;
}
console.log('HTML pages written:', pages);
console.log('Done.');
