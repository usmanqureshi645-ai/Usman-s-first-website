const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = 5500;

const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const https = require('https');
      const proxyReq = https.request({
        hostname: 'usman-s-first-website.vercel.app',
        path: req.url,
        method: req.method,
        headers: { 'content-type': 'application/json' },
      }, proxyRes => {
        let resBody = '';
        proxyRes.on('data', c => resBody += c);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(resBody);
        });
      });
      proxyReq.on('error', () => { res.writeHead(500); res.end(JSON.stringify({ error: 'Proxy failed' })); });
      proxyReq.end(body);
    });
    return;
  }
  let filePath = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/' || req.url === '') filePath = path.join(root, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log('listening on ' + port));
