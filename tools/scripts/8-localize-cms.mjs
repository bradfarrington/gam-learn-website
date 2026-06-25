import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CMSDIR = 'site/_assets/fu/modules/o7duud5CpKuaJHxJvwRJ/C7QhBwTemfxA9Kk0i1dx';
const cmsFiles = (await readdir(CMSDIR)).filter(f => f.endsWith('.framercms')).map(f => join(CMSDIR, f));

function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function extOf(u) { const p = u.split('?')[0]; const e = p.split('.').pop().toLowerCase(); return /^[a-z0-9]{2,5}$/.test(e) ? e : 'bin'; }

// collect unique framerusercontent URLs across CMS binaries
const urlRe = /https:\/\/framerusercontent\.com\/[^\s"'`)<>]+/g;
const urls = new Set();
const bufs = {};
for (const f of cmsFiles) {
  const buf = await readFile(f);
  bufs[f] = buf;
  const s = buf.toString('latin1');
  for (const m of s.match(urlRe) || []) urls.add(m);
}
console.log('Unique framerusercontent URLs in CMS binaries:', urls.size);

// download each to /c/<hash>.<ext>; build same-length replacement
async function fetchBuf(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
}

const replacements = new Map(); // original -> padded local (same byte length)
let dl = 0, fail = [];
const list = [...urls];
let idx = 0;
async function worker() {
  while (idx < list.length) {
    const u = list[idx++];
    const core = `/c/${djb2(u)}.${extOf(u)}`;
    const padLen = u.length - core.length - 1; // minus '?'
    if (padLen < 0) { fail.push([u, 'local longer than original']); continue; }
    const local = core + '?' + 'a'.repeat(padLen);
    if (local.length !== u.length) { fail.push([u, `len mismatch ${local.length} vs ${u.length}`]); continue; }
    replacements.set(u, local);
    const file = join('site', core); // strip query for the actual file path
    if (!existsSync(file)) {
      try { const b = await fetchBuf(u); await mkdir(dirname(file), { recursive: true }); await writeFile(file, b); dl++; }
      catch (e) { fail.push([u, e.message]); }
    }
  }
}
await Promise.all(Array.from({ length: 12 }, worker));
console.log('Downloaded CMS assets:', dl, 'failed:', fail.length);
fail.slice(0, 20).forEach(([u, e]) => console.log('  FAIL', e, u));

// apply same-length replacements to each binary
for (const f of cmsFiles) {
  let s = bufs[f].toString('latin1');
  const origLen = s.length;
  for (const [orig, local] of replacements) s = s.split(orig).join(local);
  if (s.length !== origLen) throw new Error(`Binary length changed for ${f}! ${origLen} -> ${s.length}`);
  await writeFile(f, Buffer.from(s, 'latin1'));
  // verify no framerusercontent left
  const left = (s.match(urlRe) || []).length;
  console.log(`Rewrote ${f} (len ${origLen} preserved, framerusercontent refs left: ${left})`);
}

// neutralize framer.com/edit references in JS modules
const MODDIR = 'site/_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K';
let edited = 0;
for (const f of (await readdir(MODDIR)).filter(x => x.endsWith('.mjs')).map(x => join(MODDIR, x))) {
  let c = await readFile(f, 'utf8');
  if (c.includes('framer.com/edit')) {
    c = c.replace(/https:\/\/framer\.com\/edit\/init\.mjs/g, 'about:blank');
    await writeFile(f, c); edited++;
  }
}
console.log('Neutralized framer.com/edit in', edited, 'modules.');
