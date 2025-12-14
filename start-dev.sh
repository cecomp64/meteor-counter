#!/bin/bash
# Start script that forwards traffic to Netlify Dev

# Start socat to forward 0.0.0.0:8888 -> 127.0.0.1:8889
echo "Starting port forwarder..."
socat TCP-LISTEN:8888,fork,bind=0.0.0.0,reuseaddr TCP:127.0.0.1:8889 &
SOCAT_PID=$!

# Start Netlify Dev on port 8889 (localhost only)
echo "Starting Netlify Dev..."
netlify dev --port 8889

# Cleanup on exit
kill $SOCAT_PID 2>/dev/null
