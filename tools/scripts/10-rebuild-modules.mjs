import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ROOT = new URL('../../', import.meta.url).pathname;
const moduleUrls = JSON.parse(await readFile(join(ROOT, 'tools/scripts/all-modules.json'), 'utf8'));

function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function localFor(u) {
  const url = new URL(u.replace(/&amp;/g, '&'));
  let rel;
  if (url.hostname === 'framerusercontent.com') {
    if (url.pathname.startsWith('/images/')) {
      rel = 'fu/images/' + (url.search ? djb2(url.search) + '_' : '') + url.pathname.split('/').pop();
    } else rel = 'fu' + url.pathname;
  } else if (url.hostname === 'fonts.gstatic.com') rel = 'fu/gstatic' + url.pathname;
  else return null;
  return '/_assets/' + rel;
}
const assetRe = /https:\/\/(?:framerusercontent\.com|fonts\.gstatic\.com)\/[^\s"'`)<>,]+/g;

async function fetchText(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
}

function transform(code, fileName) {
  let c = code;

  // (a) localize all framerusercontent / gstatic asset URLs
  c = c.replace(assetRe, (m) => localFor(m) || m);

  // (b) framercms range-loader -> fetch whole file & slice client-side (static-host friendly)
  const b0 = 'async function b(e,t){let n=We(t),r=[],i=0;';
  if (c.includes(b0)) {
    const end = 'return t.map(e=>u.read(e.from,e.to-e.from))}';
    const s = c.indexOf(b0), e = c.indexOf(end, s);
    if (e !== -1) {
      const patched = 'async function b(e,t){/* framercms-patched */let s=await V(new URL(e));if(s.status!==200)throw Error(`Request failed: ${s.status} ${s.statusText}`);let c=await s.arrayBuffer(),l=new Uint8Array(c);return t.map(e=>l.subarray(e.from,e.to))}';
      c = c.slice(0, s) + patched + c.slice(e + end.length);
    }
  }

  // (c) neutralize the Framer editor bar (no external import, renders nothing)
  c = c.replace(/let\{createEditorBar:e\}=await import\(`[^`]*`\)/g,
    'let{createEditorBar:e}=await Promise.resolve({createEditorBar:()=>()=>null})');

  // (d) icon module base -> local, drop version suffix so files resolve as clean .js
  c = c.split('`https://framer.com/m/feather-icons/`').join('`/_assets/fu/icons/feather/`');
  c = c.split('`https://framer.com/m/iconoir-icons/`').join('`/_assets/fu/icons/iconoir/`');
  c = c.split('.js@0.0.29`').join('.js`').split('.js@0.0.11`').join('.js`');

  // (e) Embed: assume iframe is allowed instead of calling api.framer.com
  c = c.replace(
    /let n=await fetch\(`https:\/\/api\.framer\.com\/functions\/check-iframe-url\?url=`\+encodeURIComponent\(e\)\);if\(n\.status==200\)\{let\{isBlocked:e\}=await n\.json\(\);t&&d\(e\)\}else\{let e=await n\.text\(\);console\.error\(e\),d\(Error\(`This site can.t be reached.`\)\)\}/g,
    't&&d(!1)');

  // (f) disable native Framer forms (empty action -> submit handler returns early at `!e`)
  c = c.replace(/action:`https:\/\/api\.framer\.com\/forms\/v1\/forms\/[0-9a-f-]+\/submit`/g, 'action:``');

  // (g) neutralize inert framer.com URLs in warning/comment strings.
  //     Exclusion set stops the match BEFORE any `${...}` template interpolation or string close.
  const inert = /https?:\/\/(?:www\.)?(?:framer\.com|events\.framer\.com)[^\s"'`)$<>{}\\]*/g;
  c = c.replace(inert, '#');

  return c;
}

let dl = 0, broken = [];
for (const url of moduleUrls) {
  const web = localFor(url);
  const file = join(ROOT, web.replace(/^\//, ''));
  await mkdir(dirname(file), { recursive: true });
  const fresh = await fetchText(url);
  const out = transform(fresh, file.split('/').pop());
  await writeFile(file, out);
  dl++;
  // syntax check
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (e) { broken.push(file.split('/').pop()); }
}
console.log(`Re-downloaded + transformed ${dl} modules.`);
console.log(broken.length ? `BROKEN (${broken.length}): ${broken.join(', ')}` : 'All modules pass node --check ✓');
