import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const MODDIR = 'site/_assets/fu/sites/3JNvQNDUeQYQkQWhoJZb7K';

// ---------- 1) Patch the .framercms range-loader to fetch the full file & slice client-side ----------
// Framer's CDN returns only requested byte ranges for `?range=` queries; a static host can't.
// We fetch the whole file once and slice locally, which is byte-identical in result.
const cmsFile = join(MODDIR, 'IjxxQMUTd.CLx-R_iR.mjs');
let cms = await readFile(cmsFile, 'utf8');
const origStart = 'async function b(e,t){let n=We(t),r=[],i=0;';
const sIdx = cms.indexOf(origStart);
if (sIdx === -1 && !cms.includes('/* framercms-patched */')) {
  throw new Error('Could not locate framercms loader function b()');
}
if (sIdx !== -1) {
  // find the end: matching '...u.read(e.from,e.to-e.from))}' that closes function b
  const endMarker = 'return t.map(e=>u.read(e.from,e.to-e.from))}';
  const eIdx = cms.indexOf(endMarker, sIdx);
  if (eIdx === -1) throw new Error('Could not locate end of loader function b()');
  const fullOrig = cms.slice(sIdx, eIdx + endMarker.length);
  const patched = 'async function b(e,t){/* framercms-patched */let s=await V(new URL(e));if(s.status!==200)throw Error(`Request failed: ${s.status} ${s.statusText}`);let c=await s.arrayBuffer(),l=new Uint8Array(c);return t.map(e=>l.subarray(e.from,e.to))}';
  cms = cms.slice(0, sIdx) + patched + cms.slice(eIdx + endMarker.length);
  await writeFile(cmsFile, cms);
  console.log('Patched framercms loader in', cmsFile);
} else {
  console.log('framercms loader already patched.');
}

// ---------- 2) Inject a URL shim into every HTML page ----------
// Makes `new URL(rel, "/_assets/...")` (root-relative base) resolve against the page origin,
// matching how Framer's absolute framerusercontent.com URLs used to behave.
const SHIM = `<script>(function(){try{var N=window.URL;function P(u,b){if(b===undefined){if(typeof u==="string"&&u.charAt(0)==="/")return new N(location.origin+u);return new N(u)}if(typeof b==="string"&&b.charAt(0)==="/")b=location.origin+b;return new N(u,b)}P.prototype=N.prototype;["createObjectURL","revokeObjectURL","canParse","parse"].forEach(function(k){if(typeof N[k]==="function")P[k]=N[k].bind(N)});window.URL=P}catch(e){}})();</script>`;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const htmls = await walk('site');
let injected = 0;
for (const f of htmls) {
  let html = await readFile(f, 'utf8');
  if (html.includes('location.origin+u)')) continue; // already injected
  // inject right after the opening <head ...>
  const m = html.match(/<head[^>]*>/i);
  if (!m) { console.warn('no <head> in', f); continue; }
  html = html.replace(m[0], m[0] + SHIM);
  await writeFile(f, html);
  injected++;
}
console.log('Injected URL shim into', injected, 'pages.');
