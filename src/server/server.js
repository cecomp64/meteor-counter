// Simple static file server for development
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Proxy API requests to Netlify Dev (if it's running)
  if (req.url.startsWith('/.netlify/functions/')) {
    proxyToNetlify(req, res);
    return;
  }

  // Remove query string
  let filePath = '.' + req.url.split('?')[0];

  // Default to index.html
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404 Not Found', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Proxy function to forward requests to Netlify Dev
function proxyToNetlify(req, res) {
  // Clone headers and set correct Host for Netlify Dev
  const headers = { ...req.headers };
  headers.host = 'localhost:8889';

  const options = {
    hostname: '127.0.0.1',
    port: 8889,
    path: req.url,
    method: req.method,
    headers: headers
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (e) => {
    console.error(`Proxy error: ${e.message}`);
    console.error('Make sure Netlify Dev is running on port 8889');
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Netlify functions unavailable',
      message: 'Make sure you are running "npm run dev" to start Netlify Dev server'
    }));
  });

  // Forward request body for POST/PUT requests
  if (req.method === 'POST' || req.method === 'PUT') {
    req.pipe(proxy);
  } else {
    proxy.end();
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log('Static files served from current directory');
  console.log('API requests to /.netlify/functions/* will be proxied to Netlify Dev (port 8889)');
  console.log('Press Ctrl+C to stop');
});
