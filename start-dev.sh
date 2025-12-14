#!/bin/bash
# Start script that forwards traffic to Netlify Dev

# Start Node.js proxy to forward 0.0.0.0:8888 -> 127.0.0.1:8889
echo "Starting port forwarder (Node.js proxy)..."
node proxy.js &
PROXY_PID=$!

# Give proxy a moment to start
sleep 1

# Start Netlify Dev on port 8889 (localhost only)
echo "Starting Netlify Dev..."
netlify dev --port 8889

# Cleanup on exit
kill $PROXY_PID 2>/dev/null
