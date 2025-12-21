#!/bin/bash
# Start script for development

# Install pg package if not present (workaround for npm proxy issues)
./scripts/install-pg.sh || exit 1

# Run database migrations
echo "Running database migrations..."
npm run migrate:up || echo "Warning: Migration failed or no pending migrations"

# Start Node.js proxy to forward 0.0.0.0:8888 -> 127.0.0.1:8889
echo "Starting port forwarder (Node.js proxy)..."
node src/server/proxy.js &
PROXY_PID=$!

# Start lightweight function server on port 8889
# This replaces Netlify Dev to avoid Docker host checking issues
echo "Starting function server..."
node src/server/function-server.js &
FUNC_PID=$!

# Give servers a moment to start
sleep 1

# Start static file server on port 3000
echo "Starting static file server..."
node src/server/server.js

# Cleanup on exit
kill $PROXY_PID $FUNC_PID 2>/dev/null
