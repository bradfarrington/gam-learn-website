import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const OUT = 'site/_assets';
const collected = JSON.parse(await readFile('scripts/collected.json', 'utf8'));

// ---- URL -> local relative path mapping ----
function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

const urlMap = new Map(); // normalized original url -> local web path (/_assets/...)
function normalize(u) { return u.replace(/&amp;/g, '&').replace(/[",;]+$/, ''); }

function localFor(u) {
  u = normalize(u);
  if (urlMap.has(u)) return urlMap.get(u);
  const url = new URL(u);
  let rel;
  if (url.hostname === 'framerusercontent.com') {
    if (url.pathname.startsWith('/images/')) {
      const base = url.pathname.split('/').pop();
      const q = url.search ? djb2(url.search) + '_' : '';
      rel = 'fu/images/' + q + base;
    } else {
      rel = 'fu' + url.pathname; // /sites/.../X.mjs etc., keep structure for relative imports
    }
  } else if (url.hostname === 'fonts.gstatic.com') {
    rel = 'fu/gstatic' + url.pathname;
  } else if (url.hostname === 'fonts.googleapis.com') {
    rel = 'fu/gfonts/' + djb2(url.href) + '.css';
  } else {
    rel = 'fu/ext/' + url.hostname + url.pathname + (url.search ? '_' + djb2(url.search) : '');
  }
  const web = '/_assets/' + rel;
  urlMap.set(u, web);
  return web;
}

// ---- download queue ----
const queue = [];
const seen = new Set();
function enqueue(u) {
  u = normalize(u);
  if (seen.has(u)) return;
  seen.add(u);
  queue.push(u);
}

[...collected.images, ...collected.modules, ...collected.gFontFiles, ...collected.gFontCss].forEach(enqueue);

async function fetchBuf(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}

let count = 0, failed = [];
async function processOne(u) {
  const web = localFor(u);
  const file = join('site', web.replace(/^\/_assets/, '_assets'));
  const isModule = u.endsWith('.mjs');
  if (existsSync(file)) {
    // still need to parse modules for new imports
    if (isModule) parseModule(await readFile(file, 'utf8'), u);
    return;
  }
  let buf;
  try { buf = await fetchBuf(u); }
  catch (e) { failed.push([u, e.message]); return; }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
  count++;
  if (count % 25 === 0) console.log(`  downloaded ${count}...`);
  if (isModule) parseModule(buf.toString('utf8'), u);
}

// parse a module for import specifiers and enqueue resolved absolute URLs
function parseModule(code, baseUrl) {
  const specs = new Set();
  const reStatic = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reDyn = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [reStatic, reBare, reDyn]) {
    let m; while ((m = re.exec(code))) specs.add(m[1]);
  }
  for (const s of specs) {
    if (!/\.(mjs|js)(\?|$)/.test(s)) continue;
    try { enqueue(new URL(s, baseUrl).href); } catch {}
  }
}

// process with bounded concurrency, looping while queue grows (module crawl)
const CONC = 12;
let idx = 0;
async function worker() {
  while (idx < queue.length) {
    const u = queue[idx++];
    await processOne(u);
  }
}
let prevLen = -1;
while (queue.length !== prevLen) {
  prevLen = queue.length;
  await Promise.all(Array.from({ length: CONC }, worker));
}

console.log(`\nDownloaded ${count} new files. Total mapped URLs: ${urlMap.size}. Queue size: ${queue.length}`);
if (failed.length) {
  console.log('FAILED:', failed.length);
  failed.slice(0, 30).forEach(([u, e]) => console.log('  ', e, u));
}
// persist url map + full module list for rewrite step
await writeFile('scripts/urlmap.json', JSON.stringify(Object.fromEntries(urlMap), null, 2));
await writeFile('scripts/all-modules.json', JSON.stringify(queue.filter(u => u.endsWith('.mjs')), null, 2));
console.log('Wrote scripts/urlmap.json (', urlMap.size, 'entries )');
