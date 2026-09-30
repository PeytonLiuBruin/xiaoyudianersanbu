/** Dependency-free local player for dist/ and a copied static release folder. */
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function option(name, fallback) {
  const inline = args.find(value => value.startsWith(`--${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
for (let index = 0; index < args.length; index++) {
  if (/^--(?:base|port|dir)=/.test(args[index])) continue;
  if (/^--(?:base|port|dir)$/.test(args[index]) && args[index + 1] !== undefined) { index++; continue; }
  console.error(`未知或缺少参数：${args[index]}`);
  process.exit(1);
}

const port = Number(option('port', '4173'));
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('--port 必须是 0 到 65535 的整数。'); process.exit(1);
}
let base = option('base', '/');
if (!base || !base.startsWith('/') || /[?#\\\0]/.test(base) || base.split('/').some(segment => segment === '.' || segment === '..')) {
  console.error('--base 需要以 / 开头的站内路径，例如 /xiaoyudianersanbu/。'); process.exit(1);
}
base = base.replace(/\/+$/, '') + '/';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.basename(scriptDirectory) === 'scripts' ? path.dirname(scriptDirectory) : scriptDirectory;
const suppliedDirectory = option('dir', undefined);
const directory = suppliedDirectory ? path.resolve(suppliedDirectory) :
  existsSync(path.join(projectDirectory, 'dist', 'index.html')) ? path.join(projectDirectory, 'dist') : projectDirectory;
if (!existsSync(path.join(directory, 'index.html')) ||
    (!suppliedDirectory && directory === projectDirectory && existsSync(path.join(projectDirectory, 'src')))) {
  console.error('没有找到构建后的游戏。请先运行 npm run build，或在完整静态游戏文件夹内启动。');
  process.exit(1);
}
const root = await realpath(directory);
const insideRoot = file => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
};
function error(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-cache');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    error(response, 405, 'Method not allowed'); return;
  }
  let pathname;
  try { pathname = decodeURIComponent((request.url ?? '/').split('?')[0]); }
  catch { error(response, 400, 'Invalid URL'); return; }
  if (/[\\\0]/.test(pathname) || pathname.split('/').some(segment => segment === '.' || segment === '..')) {
    error(response, 400, 'Invalid path'); return;
  }
  if (base !== '/' && pathname === base.slice(0, -1)) {
    response.writeHead(308, { Location: base }); response.end(); return;
  }
  if (!pathname.startsWith(base)) { error(response, 404, 'Not found'); return; }
  let filename = path.resolve(root, pathname.slice(base.length) || 'index.html');
  if (!insideRoot(filename)) { error(response, 403, 'Forbidden'); return; }
  try {
    let details = await stat(filename);
    if (details.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(308, { Location: pathname + '/' }); response.end(); return;
      }
      filename = path.join(filename, 'index.html');
      details = await stat(filename);
    }
    if (!details.isFile() || !insideRoot(await realpath(filename))) { error(response, 403, 'Forbidden'); return; }
    const headers = {
      'Content-Type': mime[path.extname(filename).toLowerCase()] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': details.size,
    };
    let start = 0, end = details.size - 1, status = 200;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match || (!match[1] && !match[2])) {
        response.setHeader('Content-Range', `bytes */${details.size}`);
        error(response, 416, 'Invalid range'); return;
      }
      if (!match[1]) start = Math.max(0, details.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= details.size) {
        response.setHeader('Content-Range', `bytes */${details.size}`);
        error(response, 416, 'Invalid range'); return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${details.size}`;
      headers['Content-Length'] = end - start + 1;
    }
    response.writeHead(status, headers);
    if (request.method === 'HEAD' || details.size === 0) { response.end(); return; }
    const stream = createReadStream(filename, { start, end });
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (failure) {
    if (failure.code === 'ENOENT' || failure.code === 'ENOTDIR') error(response, 404, 'Not found');
    else error(response, 500, 'Could not read file');
  }
});
server.on('error', failure => {
  console.error(failure.code === 'EADDRINUSE' ? `端口 ${port} 已被使用。可加 --port=4174 重试。` : failure.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`小雨点儿出门了：http://127.0.0.1:${server.address().port}${base}`);
  console.log('保持窗口开启；按 Ctrl+C 结束。');
});
