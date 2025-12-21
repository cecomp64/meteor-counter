#!/bin/bash
echo "=== Checking file structure in container ==="
docker-compose exec app ls -la /workspace/ | head -20
echo ""
echo "=== Checking if index.html exists ==="
docker-compose exec app ls -la /workspace/index.html
echo ""
echo "=== Checking Netlify's view ==="
docker-compose exec app pwd
