#!/bin/bash
# Start script for development

# Start Node.js proxy to forward 0.0.0.0:8888 -> 127.0.0.1:8889
echo "Starting port forwarder (Node.js proxy)..."
node proxy.js &
PROXY_PID=$!

# Start lightweight function server on port 8889
# This replaces Netlify Dev to avoid Docker host checking issues
echo "Starting function server..."
node function-server.js &
FUNC_PID=$!

# Give servers a moment to start
sleep 1

# Start static file server on port 3000
echo "Starting static file server..."
node server.js

# Cleanup on exit
kill $PROXY_PID $FUNC_PID 2>/dev/null
