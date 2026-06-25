import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ROOT = new URL('../../', import.meta.url).pathname;     // repo root
const SITES = join(ROOT, '_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K');
const ICONDIR = join(ROOT, '_assets/fu/icons/feather');

async function fetchText(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
}
const fuToLocal = (u) => u.replace('https://framerusercontent.com', '/_assets/fu');
const localToFile = (web) => join(ROOT, web.replace(/^\//, ''));

// ---------- 1) ICONS: localize the 3 used feather icons (shim -> real module, recursive) ----------
const ICONS = ['arrow-right', 'minus', 'plus'];
await mkdir(ICONDIR, { recursive: true });
const fuModuleRe = /https:\/\/framerusercontent\.com\/[^\s"'`)]+/g;

async function downloadRealModule(url, seen = new Set()) {
  if (seen.has(url)) return; seen.add(url);
  const web = fuToLocal(url);
  const file = localToFile(web);
  let code;
  if (existsSync(file)) code = await readFile(file, 'utf8');
  else { code = await fetchText(url); await mkdir(dirname(file), { recursive: true }); }
  // rewrite any framerusercontent imports in this module to local, recurse first
  const refs = [...new Set(code.match(fuModuleRe) || [])];
  for (const r of refs) await downloadRealModule(r, seen);
  let out = code;
  for (const r of refs) out = out.split(r).join(fuToLocal(r));
  await writeFile(file, out);
}

for (const name of ICONS) {
  const shimFile = join(ICONDIR, name + '.js');
  // ensure shim present
  let shim = existsSync(shimFile) ? await readFile(shimFile, 'utf8') : await fetchText(`https://framer.com/m/feather-icons/${name}.js@0.0.29`);
  const realUrls = [...new Set(shim.match(fuModuleRe) || [])];
  for (const u of realUrls) await downloadRealModule(u);
  // rewrite shim: point at local real modules, strip framer comment/asset-urls
  let out = shim;
  for (const u of realUrls) out = out.split(u).join(fuToLocal(u));
  out = out.replace(/\/\*[\s\S]*?\*\//, '').replace(/https:\/\/www\.framer\.com\/asset-urls/g, '');
  await writeFile(shimFile, out);
  console.log(`Icon localized: ${name} (real modules: ${realUrls.length})`);
}

// ---------- 2..5) Patch the JS bundles ----------
const modFiles = (await readdir(SITES)).filter(f => f.endsWith('.mjs')).map(f => join(SITES, f));
let patched = { iconBase: 0, iframe: 0, forms: 0, strings: 0 };

for (const f of modFiles) {
  let c = await readFile(f, 'utf8');
  const before = c;

  // 2) icon base URLs -> local, and drop the version suffix so files resolve as clean .js
  c = c.split('`https://framer.com/m/feather-icons/`').join('`/_assets/fu/icons/feather/`');
  c = c.split('`https://framer.com/m/iconoir-icons/`').join('`/_assets/fu/icons/iconoir/`');
  c = c.split('.js@0.0.29`').join('.js`').split('.js@0.0.11`').join('.js`');

  // 3) Embed: skip the api.framer.com iframe-allowlist check (assume embeddable, no network call)
  c = c.replace(
    /let n=await fetch\(`https:\/\/api\.framer\.com\/functions\/check-iframe-url\?url=`\+encodeURIComponent\(e\)\);if\(n\.status==200\)\{let\{isBlocked:e\}=await n\.json\(\);t&&d\(e\)\}else\{let e=await n\.text\(\);console\.error\(e\),d\(Error\(`This site can.t be reached.`\)\)\}/g,
    't&&d(!1)'
  );

  // 4) Disable the 3 native Framer forms: empty action => submit handler returns early (`!e`)
  c = c.replace(/action:`https:\/\/api\.framer\.com\/forms\/v1\/forms\/[0-9a-f-]+\/submit`/g, 'action:``');

  // 5) Neutralise inert framer.com URLs left in console-warning / comment strings
  c = c.replace(/https:\/\/www\.framer\.com\/[^\s"'`)]*/g, '#')
       .replace(/https:\/\/framer\.com\/[^\s"'`)]*/g, '#')
       .replace(/https:\/\/www\.framer\.com/g, '#')
       .replace(/https:\/\/framer\.com/g, '#');

  if (c !== before) {
    await writeFile(f, c);
    if (before.includes('framer.com/m/feather') || before.includes('framer.com/m/iconoir')) patched.iconBase++;
    if (before.includes('check-iframe-url')) patched.iframe++;
    if (before.includes('api.framer.com/forms')) patched.forms++;
    patched.strings++;
  }
}
console.log('Bundle patches:', patched);

// ---------- 6) Strip framer branding metas from all HTML ----------
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['_assets', 'tools', 'raw', '.git', 'c'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const htmls = await walk(ROOT);
let metaStripped = 0;
for (const f of htmls) {
  let h = await readFile(f, 'utf8');
  const b = h;
  h = h.replace(/<meta name="generator" content="Framer[^"]*">/g, '');
  // framer-search-index meta already points local; leave it (functional). Remove only if external.
  h = h.replace(/<meta name="framer-search-index" content="https:\/\/[^"]*">/g, '');
  if (h !== b) { await writeFile(f, h); metaStripped++; }
}
console.log('HTML meta stripped in', metaStripped, 'pages.');
console.log('Scrub complete.');
