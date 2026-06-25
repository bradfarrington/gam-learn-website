import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const { fu, gstatic } = JSON.parse(await readFile('scripts/module-assets.json', 'utf8'));
const urlMap = new Map(Object.entries(JSON.parse(await readFile('scripts/urlmap.json', 'utf8'))));

function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

function localFor(u) {
  const url = new URL(u);
  let rel;
  if (url.hostname === 'framerusercontent.com') {
    if (url.pathname.startsWith('/images/')) {
      const base = url.pathname.split('/').pop();
      rel = 'fu/images/' + (url.search ? djb2(url.search) + '_' : '') + base;
    } else rel = 'fu' + url.pathname;
  } else if (url.hostname === 'fonts.gstatic.com') {
    rel = 'fu/gstatic' + url.pathname;
  } else rel = 'fu/ext/' + url.hostname + url.pathname;
  return '/_assets/' + rel;
}

async function fetchBuf(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
}

const all = [...fu, ...gstatic].filter(u => { try { new URL(u); return /\.(woff2|png|jpg|jpeg|webp|svg|mp4|gif|avif)$/i.test(new URL(u).pathname); } catch { return false; } });
let count = 0, failed = [];
const CONC = 12; let idx = 0;
async function worker() {
  while (idx < all.length) {
    const u = all[idx++];
    const web = localFor(u);
    urlMap.set(u, web);
    const file = join('site', web.replace(/^\/_assets/, '_assets'));
    if (existsSync(file)) continue;
    let buf; try { buf = await fetchBuf(u); } catch (e) { failed.push([u, e.message]); continue; }
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buf); count++;
    if (count % 25 === 0) console.log('  downloaded', count, '...');
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`Downloaded ${count} module-embedded assets. Failed: ${failed.length}`);
failed.slice(0, 20).forEach(([u, e]) => console.log('  ', e, u));
await writeFile('scripts/urlmap.json', JSON.stringify(Object.fromEntries(urlMap), null, 2));
console.log('urlmap now has', urlMap.size, 'entries');
