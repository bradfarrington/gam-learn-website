import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Recursively list all raw HTML files
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const htmlFiles = await walk('raw');
const fuUrls = new Set();      // framerusercontent.com (images + sites)
const gFontCss = new Set();    // fonts.googleapis.com css
const gFontFiles = new Set();  // fonts.gstatic.com
const otherExternal = new Set();

// Match any URL (handles &amp; entity encoding too)
const urlRe = /https?:\/\/[^\s"'`)<>\\]+/g;

for (const f of htmlFiles) {
  let html = await readFile(f, 'utf8');
  html = html.replace(/&amp;/g, '&');
  const matches = html.match(urlRe) || [];
  for (let u of matches) {
    u = u.replace(/[",;]+$/, '');
    if (u.includes('framerusercontent.com')) fuUrls.add(u);
    else if (u.includes('fonts.googleapis.com')) gFontCss.add(u);
    else if (u.includes('fonts.gstatic.com')) gFontFiles.add(u);
    else if (/^https?:\/\//.test(u)) otherExternal.add(new URL(u).host);
  }
}

const images = [...fuUrls].filter(u => u.includes('/images/'));
const modules = [...fuUrls].filter(u => u.endsWith('.mjs') || u.includes('/sites/'));

console.log('HTML files scanned:', htmlFiles.length);
console.log('Unique framerusercontent URLs:', fuUrls.size);
console.log('  - images:', images.length);
console.log('  - module/site files:', modules.length);
console.log('Google Fonts CSS:', gFontCss.size);
console.log('Google font files (direct):', gFontFiles.size);
console.log('\nOther external hosts referenced:');
for (const h of [...otherExternal].sort()) console.log('  ', h);

await writeFile('scripts/collected.json', JSON.stringify({
  images: [...fuUrls].filter(u => u.includes('/images/')),
  modules: [...fuUrls].filter(u => !u.includes('/images/')),
  gFontCss: [...gFontCss],
  gFontFiles: [...gFontFiles],
}, null, 2));
console.log('\nWrote scripts/collected.json');
