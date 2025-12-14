#!/bin/sh
# Start a simple HTTP server alongside Netlify functions

# Start Python HTTP server in background to serve static files
echo "Starting static file server on port 3000..."
python3 -m http.server 3000 &

# Start Netlify Dev with framework detection disabled
echo "Starting Netlify Dev..."
exec netlify dev --dir . --staticServerPort 3000
