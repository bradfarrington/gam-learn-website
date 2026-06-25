// Minimal static server that mirrors Vercel's cleanUrls + trailingSlash:false behaviour,
// so local verification matches production routing.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

// Repo root is the deployable web root (two levels up from tools/scripts/).
const ROOT = new URL('../../', import.meta.url).pathname;
const PORT = process.env.PORT || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

async function tryFiles(pathname) {
  const candidates = [];
  if (pathname === '/' || pathname === '') candidates.push('index.html');
  else {
    const p = pathname.replace(/^\//, '').replace(/\/$/, '');
    candidates.push(p);                 // exact (assets)
    candidates.push(p + '.html');       // cleanUrl page
    candidates.push(join(p, 'index.html'));
  }
  for (const c of candidates) {
    const fp = join(ROOT, c);
    try { const s = await stat(fp); if (s.isFile()) return fp; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let fp = await tryFiles(pathname);
  let status = 200;
  if (!fp) { fp = join(ROOT, '404.html'); status = 404; }
  try {
    const buf = await readFile(fp);
    const type = MIME[extname(fp)] || 'application/octet-stream';
    const range = req.headers.range;
    if (range && status === 200) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : buf.length - 1;
        res.writeHead(206, {
          'Content-Type': type, 'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${buf.length}`,
          'Content-Length': end - start + 1,
        });
        return res.end(buf.subarray(start, end + 1));
      }
    }
    res.writeHead(status, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
    res.end(buf);
  } catch {
    res.writeHead(500); res.end('500');
  }
}).listen(PORT, () => console.log(`Serving site/ at http://localhost:${PORT}`));
