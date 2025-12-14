# Docker Development Environment

This directory includes a complete Docker-based development environment that isolates all dependencies.

## 🚀 Quick Start

```bash
# Start everything
./dev.sh start

# Wait a moment for services to start, then open:
# http://localhost:8888
```

That's it! The app and database are now running in Docker containers.

## 📋 What Gets Started

- **PostgreSQL Database** (port 5432)
  - Auto-loads schema on first start
  - Data persists in Docker volume

- **Node.js App Container** (port 8888)
  - Runs `npm run dev` (Netlify Dev server)
  - Live reloads when you edit files
  - Has npm, Node.js, and all dependencies

## 🛠️ Helper Commands

```bash
# Start services
./dev.sh start

# View logs
./dev.sh logs              # All logs
./dev.sh logs app          # Just app logs
./dev.sh logs postgres     # Just database logs

# Access database
./dev.sh psql

# Open shell in app container (for debugging)
./dev.sh shell

# Reset database
./dev.sh reset-db

# Restart services
./dev.sh restart

# Stop services
./dev.sh stop

# Rebuild containers (if you change Dockerfile)
./dev.sh rebuild

# Clean everything (including data!)
./dev.sh clean
```

## 📁 How It Works

### File Mounting
Your local files are mounted into the container:
```
./index.html    → /app/index.html
./app.js        → /app/app.js
./db.js         → /app/db.js
...etc
```

Changes you make locally are immediately reflected in the container!

### Network
Both containers are on the same network, so they can talk to each other:
- App connects to database at: `postgres:5432`
- You access app at: `http://localhost:8888`

## 🧪 Testing Sync

1. **Start services:**
   ```bash
   ./dev.sh start
   ```

2. **Open app:**
   ```
   http://localhost:8888
   ```

3. **Create a test observation session**
   - Click "Start Observing"
   - Record some meteors
   - Stop session

4. **Sync to database:**
   - Go to "Sync Settings"
   - Click "Sync All Data"

5. **Verify in database:**
   ```bash
   ./dev.sh psql
   ```

   Then in psql:
   ```sql
   SELECT * FROM sessions;
   SELECT * FROM observations;
   \q
   ```

## 🔧 Troubleshooting

### App won't start
```bash
# Check logs
./dev.sh logs app

# Common issue: port already in use
lsof -ti:8888 | xargs kill -9
./dev.sh restart
```

### Database connection errors
```bash
# Check if database is healthy
docker-compose ps

# Should show:
# meteor-counter-db    Up (healthy)

# Reset database
./dev.sh reset-db
```

### "npm install" errors / missing dependencies
```bash
# Rebuild the container
./dev.sh rebuild
```

### Changes not appearing
The app should auto-reload when you edit files. If not:
```bash
# Restart the app container
docker-compose restart app

# Or check logs for errors
./dev.sh logs app
```

### Container keeps restarting
```bash
# Check what's wrong
./dev.sh logs app

# Common causes:
# - Syntax error in JavaScript
# - Missing .env file (should be auto-created)
# - Port conflict
```

## 🎯 Development Workflow

```bash
# 1. Start services
./dev.sh start

# 2. Open in browser
open http://localhost:8888

# 3. Edit files in your editor
# Files auto-reload!

# 4. Check logs if needed
./dev.sh logs app

# 5. Test database
./dev.sh psql

# 6. When done
./dev.sh stop
```

## 📊 Database Access

### From command line:
```bash
./dev.sh psql
```

### From GUI tools:
```
Host:     localhost
Port:     5432
Database: meteor_counter
Username: meteor
Password: meteor_dev_password
```

### Example queries:
```sql
-- View all sessions
SELECT id, start_time, end_time, total_observations
FROM sessions
ORDER BY start_time DESC;

-- Count synced data
SELECT
  (SELECT COUNT(*) FROM sessions) as sessions,
  (SELECT COUNT(*) FROM observations) as observations;

-- View session with observations
SELECT s.id, s.start_time, COUNT(o.id) as obs_count
FROM sessions s
LEFT JOIN observations o ON s.id = o.session_id
GROUP BY s.id, s.start_time;
```

## 🧹 Cleanup

```bash
# Stop services (keeps data)
./dev.sh stop

# Remove everything including data
./dev.sh clean
```

## 💡 Tips

- **Live Reload**: Edit any `.js`, `.html`, or `.css` file and the app auto-reloads
- **Isolated npm**: Your local npm config won't interfere
- **Fresh Start**: `./dev.sh rebuild` gives you a clean slate
- **Database Persistence**: Data survives container restarts (but not `./dev.sh clean`)

## 🐛 Advanced Debugging

### Run custom commands in app container:
```bash
docker-compose exec app npm install some-package
docker-compose exec app ls -la
docker-compose exec app cat .env
```

### View environment variables:
```bash
docker-compose exec app env | grep DATABASE
```

### Check network connectivity:
```bash
docker-compose exec app ping postgres
```

## 🔄 Updating Code

When you pull new changes from git:
```bash
git pull
./dev.sh rebuild  # Rebuilds containers with new dependencies
```

---

Need help? Check the logs with `./dev.sh logs` or open a shell with `./dev.sh shell`.
