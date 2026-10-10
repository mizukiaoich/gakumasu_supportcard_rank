// 依存パッケージなしのローカル確認用静的サーバー。
//   node scripts/serve.mjs [--port 8080] [--base /gakumasu_supportcard_rank/]
// --base を指定すると GitHub Pages のプロジェクトサイトと同じサブパス配下で配信する。
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

export function createServer({ base = '/', root = ROOT } = {}) {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (`${pathname}/` === prefix) pathname = prefix;
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end('Not Found');
      return;
    }
    const rel = pathname.slice(prefix.length);
    let file = path.join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const info = await stat(file);
      if (info.isDirectory()) {
        // GitHub Pages と同様に、末尾スラッシュなしのディレクトリはリダイレクトする
        if (!pathname.endsWith('/')) {
          res.writeHead(301, { Location: `${pathname}/` }).end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const port = Number(opt('--port', process.env.PORT ?? 8080));
  const base = opt('--base', '/');
  createServer({ base }).listen(port, () => {
    console.log(`http://localhost:${port}${base.endsWith('/') ? base : `${base}/`} で配信中（Ctrl+C で終了）`);
  });
}
