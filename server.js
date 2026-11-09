// Minimal local static server (Node stdlib only). Binds to 127.0.0.1 and serves
// only the app files and the bundled pdf.js. The CSP header blocks every
// request to any other origin, so the page cannot load or send anything external.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = import.meta.dirname;
const port = Number(process.env.PORT) || 8080;
const allow = ['index.html', 'app.js', 'match.js', 'samples/', 'node_modules/pdfjs-dist/build/', 'node_modules/pdfjs-dist/standard_fonts/'];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

http.createServer((req, res) => {
  let rel;
  try { rel = path.relative(root, path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))).replaceAll('\\', '/'); }
  catch { rel = '..'; }
  if (rel === '') rel = 'index.html';
  if (!allow.some(a => rel === a || (a.endsWith('/') && rel.startsWith(a))) || rel.includes('..')) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(path.join(root, rel), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(rel)] || 'application/octet-stream',
      'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Résumé checker running at http://127.0.0.1:${port}/`));
