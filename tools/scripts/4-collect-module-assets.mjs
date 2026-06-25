import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MODDIR = 'site/_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K';
const files = (await readdir(MODDIR)).filter(f => f.endsWith('.mjs'));

const fu = new Set();       // framerusercontent.com asset urls (woff2, images, etc.)
const gstatic = new Set();  // fonts.gstatic.com
const reFu = /https:\/\/framerusercontent\.com\/[^\s"'`)]+/g;
const reGs = /https:\/\/fonts\.gstatic\.com\/[^\s"'`)]+/g;

for (const f of files) {
  const code = await readFile(join(MODDIR, f), 'utf8');
  for (const m of code.match(reFu) || []) fu.add(m.replace(/[`'",;]+$/, ''));
  for (const m of code.match(reGs) || []) gstatic.add(m.replace(/[`'",;]+$/, ''));
}

// categorise framerusercontent
const byExt = {};
for (const u of fu) {
  const ext = (u.split('?')[0].split('.').pop() || '').toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + 1;
}
console.log('Embedded framerusercontent URLs in modules:', fu.size);
console.log('  by extension:', byExt);
console.log('Embedded gstatic URLs:', gstatic.size);

await writeFile('scripts/module-assets.json', JSON.stringify({ fu: [...fu], gstatic: [...gstatic] }, null, 2));
console.log('Wrote scripts/module-assets.json');
