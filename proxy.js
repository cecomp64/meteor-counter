// Simple TCP proxy to forward 0.0.0.0:8888 -> 127.0.0.1:8889
const net = require('net');

const LISTEN_PORT = 8888;
const LISTEN_HOST = '0.0.0.0';
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 8889;

const server = net.createServer((clientSocket) => {
  console.log(`[Proxy] New connection from ${clientSocket.remoteAddress}:${clientSocket.remotePort}`);

  const serverSocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    console.log(`[Proxy] Connected to ${TARGET_HOST}:${TARGET_PORT}`);
  });

  // Pipe data between client and server
  clientSocket.pipe(serverSocket);
  serverSocket.pipe(clientSocket);

  // Handle errors
  clientSocket.on('error', (err) => {
    console.error('[Proxy] Client socket error:', err.message);
    serverSocket.end();
  });

  serverSocket.on('error', (err) => {
    console.error('[Proxy] Server socket error:', err.message);
    clientSocket.end();
  });

  // Handle disconnections
  clientSocket.on('end', () => {
    console.log('[Proxy] Client disconnected');
    serverSocket.end();
  });

  serverSocket.on('end', () => {
    console.log('[Proxy] Server disconnected');
    clientSocket.end();
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[Proxy] Listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
  console.log(`[Proxy] Forwarding to ${TARGET_HOST}:${TARGET_PORT}`);
});

server.on('error', (err) => {
  console.error('[Proxy] Server error:', err);
  process.exit(1);
});
