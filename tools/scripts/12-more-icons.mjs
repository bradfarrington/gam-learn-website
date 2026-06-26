import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ROOT = new URL('../../', import.meta.url).pathname;
const ICONDIR = join(ROOT, '_assets/fu/icons/feather');

// All feather icons the nav/menu/UI can reference (from grep of component iconSelection values)
const NEEDED = [
  'arrow-right', 'plus', 'minus', 'x',
  'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right',
  'chevrons-down', 'chevrons-up', 'chevrons-left', 'chevrons-right',
  'home', 'menu', 'arrow-left', 'arrow-up', 'arrow-down',
];

async function fetchText(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
}
const fuRe = /https:\/\/framerusercontent\.com\/[^\s"'`)]+/g;
const fuToLocal = (u) => u.replace('https://framerusercontent.com', '/_assets/fu');
// apply the same identifier rename used site-wide so new files stay consistent
const deframer = (s) => s.replace(/framer/g, 'glearn').replace(/Framer/g, 'Glearn').replace(/FRAMER/g, 'GLEARN');

await mkdir(ICONDIR, { recursive: true });
let added = [], skipped = [], failed = [];

async function dlReal(url, seen = new Set()) {
  if (seen.has(url)) return; seen.add(url);
  const file = join(ROOT, fuToLocal(url).replace(/^\//, ''));
  let code = existsSync(file) ? await readFile(file, 'utf8') : await fetchText(url);
  const refs = [...new Set(code.match(fuRe) || [])];
  for (const r of refs) await dlReal(r, seen);
  let out = code;
  for (const r of refs) out = out.split(r).join(fuToLocal(r));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, deframer(out));
}

for (const name of NEEDED) {
  const shimFile = join(ICONDIR, name + '.js');
  if (existsSync(shimFile)) { skipped.push(name); continue; }
  let shim;
  try { shim = await fetchText(`https://framer.com/m/feather-icons/${name}.js@0.0.29`); }
  catch (e) { failed.push(name); continue; }
  const realUrls = [...new Set(shim.match(fuRe) || [])];
  try { for (const u of realUrls) await dlReal(u); }
  catch (e) { failed.push(name + '(real)'); continue; }
  let out = shim;
  for (const u of realUrls) out = out.split(u).join(fuToLocal(u));
  out = out.replace(/\/\*[\s\S]*?\*\//, '').replace(/https:\/\/www\.framer\.com\/asset-urls/g, '');
  await writeFile(shimFile, deframer(out));
  added.push(name);
}
console.log('Added icons:', added.join(', ') || '(none)');
console.log('Already present:', skipped.join(', '));
if (failed.length) console.log('Failed (likely not real feather icons):', failed.join(', '));
console.log('\nFeather icon dir now:', (await readdir(ICONDIR)).join(', '));
