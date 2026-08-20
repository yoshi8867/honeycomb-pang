// 로컬 확인용 정적 서버. `npm run dev` -> http://localhost:5173
// ES 모듈을 쓰기 때문에 file:// 로는 열리지 않는다.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
