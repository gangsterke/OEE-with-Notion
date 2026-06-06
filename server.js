const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

function notionRequest(method, endpoint, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.notion.com',
      path: endpoint,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notion-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqPath = req.url.split('?')[0];

  // ── Serve dashboard HTML ──
  if (req.method === 'GET' && (reqPath === '/' || reqPath === '/index.html')) {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // ── Proxy any POST to /notion/* → api.notion.com ──
  if (req.method === 'POST' && reqPath.startsWith('/notion/')) {
    const token = req.headers['x-notion-token'];
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing x-notion-token header' }));
      return;
    }

    // Strip the /notion prefix to get the real Notion API path
    const notionPath = reqPath.slice('/notion'.length);  // e.g. /v1/databases/xxx/query

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};
        const result = await notionRequest('POST', notionPath, token, parsedBody);
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(result.body);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── 404 for everything else ──
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path: reqPath }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     OEE DASHBOARD PROXY SERVER       ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Running at http://localhost:${PORT}     ║`);
  console.log('  ║  Open that URL in your browser       ║');
  console.log('  ║  Press Ctrl+C to stop                ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
