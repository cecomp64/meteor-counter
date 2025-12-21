// Simple server to run Netlify functions directly (without Netlify Dev)
// This avoids host checking issues in Docker environments
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8889;
const HOST = '0.0.0.0'; // Bind to all interfaces for Docker
const FUNCTIONS_DIR = '../../netlify/functions';

const server = http.createServer(async (req, res) => {
  console.log(`[Functions] ${req.method} ${req.url}`);

  // Only handle function requests
  if (!req.url.startsWith('/.netlify/functions/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // Extract function name from URL
  const functionName = req.url.replace('/.netlify/functions/', '').split('?')[0];
  const functionPath = path.join(__dirname, FUNCTIONS_DIR, `${functionName}.js`);

  // Check if function exists
  if (!fs.existsSync(functionPath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Function '${functionName}' not found` }));
    return;
  }

  try {
    // Read request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      // Load the function (clear require cache for hot reload)
      const absPath = path.resolve(functionPath);
      delete require.cache[absPath];
      const functionModule = require(absPath);

      // Create Netlify function event object
      const event = {
        httpMethod: req.method,
        headers: req.headers,
        body: body,
        path: req.url,
        queryStringParameters: parseQueryString(req.url)
      };

      // Execute the function
      const result = await functionModule.handler(event);

      // Send response
      res.writeHead(result.statusCode || 200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        ...result.headers
      });
      res.end(result.body);
    });

  } catch (error) {
    console.error(`[Functions] Error executing ${functionName}:`, error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Function execution failed',
      message: error.message
    }));
  }
});

function parseQueryString(url) {
  const queryString = url.split('?')[1];
  if (!queryString) return {};

  const params = {};
  queryString.split('&').forEach(param => {
    const [key, value] = param.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  });
  return params;
}

server.listen(PORT, HOST, () => {
  console.log(`[Functions] Server running at http://${HOST}:${PORT}/`);
  console.log(`[Functions] Serving functions from ${FUNCTIONS_DIR}`);
  console.log('[Functions] Press Ctrl+C to stop');
});

server.on('error', (err) => {
  console.error('[Functions] Server error:', err);
  process.exit(1);
});
