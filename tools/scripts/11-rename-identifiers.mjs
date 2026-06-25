import { readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const TEXT_EXT = ['.html', '.mjs', '.js', '.css', '.json'];
const SKIP_DIRS = new Set(['tools', '.git']);

// Uniform identifier rename. Because we apply it to BOTH the HTML (attributes/classes)
// and the JS (string keys, dataset camelCase, import paths), every reference stays consistent.
// The .framercms binaries contain no "framer" bytes, so they are NOT touched (no corruption).
const REPLACEMENTS = [
  [/framer/g, 'glearn'],
  [/Framer/g, 'Glearn'],
  [/FRAMER/g, 'GLEARN'],
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const all = await walk(ROOT);
const textFiles = all.filter(f => TEXT_EXT.some(x => f.endsWith(x)));

let changed = 0, totalHits = 0;
for (const f of textFiles) {
  let c = await readFile(f, 'utf8');
  const before = c;
  let hits = (c.match(/framer/gi) || []).length;
  for (const [re, to] of REPLACEMENTS) c = c.replace(re, to);
  if (c !== before) { await writeFile(f, c); changed++; totalHits += hits; }
}
console.log(`Text files updated: ${changed} (${totalHits} 'framer' occurrences replaced)`);

// Rename files whose NAME contains 'framer' (refs to them were already updated above)
const toRename = all.filter(f => /framer/i.test(f.split('/').pop()));
for (const f of toRename) {
  const dir = f.slice(0, f.lastIndexOf('/'));
  const base = f.split('/').pop().replace(/framer/g, 'glearn').replace(/Framer/g, 'Glearn');
  await rename(f, join(dir, base));
  console.log('Renamed file:', f.replace(ROOT, ''), '->', base);
}

// Syntax-check every module
const SITES = join(ROOT, '_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K');
const mods = (await readdir(SITES)).filter(x => x.endsWith('.mjs'));
let broken = [];
for (const m of mods) {
  try { execFileSync(process.execPath, ['--check', join(SITES, m)], { stdio: 'pipe' }); }
  catch { broken.push(m); }
}
console.log(broken.length ? `BROKEN modules: ${broken.join(', ')}` : `All ${mods.length} modules pass node --check ✓`);

// Final: confirm zero 'framer' left in deployable text + filenames
const after = await walk(ROOT);
let leftFiles = after.filter(f => /framer/i.test(f.split('/').pop()) && !f.includes('/tools/'));
let leftText = 0;
for (const f of after.filter(f => TEXT_EXT.some(x => f.endsWith(x)) && !f.includes('/tools/'))) {
  leftText += ((await readFile(f, 'utf8')).match(/framer/gi) || []).length;
}
console.log(`Remaining 'framer' in text: ${leftText}; in filenames: ${leftFiles.length}`);
