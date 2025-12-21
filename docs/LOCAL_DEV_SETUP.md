# Local Development Setup

This guide shows you how to test the remote sync functionality locally during development.

## Option 1: Use Neon Free Tier (Recommended)

**Why:** Neon offers a generous free tier that's perfect for development. It's the easiest option and matches production exactly.

### Steps:

1. **Create a free Neon account**
   - Go to https://neon.tech
   - Sign up (free tier includes 10 projects, 3 GB storage)
   - Create a new project called "meteor-counter-dev"

2. **Get your connection string**
   - In the Neon dashboard, click "Connection Details"
   - Copy the connection string (looks like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)

3. **Set up your local environment**
   ```bash
   # Create .env file
   echo "DATABASE_URL=your-neon-connection-string" > .env
   ```

4. **Initialize the database**
   ```bash
   # Install psql if you don't have it (macOS)
   brew install postgresql

   # Or on Ubuntu/Debian
   sudo apt-get install postgresql-client

   # Run the schema
   psql "your-connection-string-here" < src/database/schema.sql
   ```

5. **Install dependencies and run**
   ```bash
   npm install
   npm run dev
   ```

6. **Test sync**
   - Open http://localhost:8888
   - Create a test observation session
   - Go to Sync Settings
   - Click "Sync All Data"
   - Check Neon dashboard to see your data!

**Pros:**
- ✅ Matches production environment exactly
- ✅ No local setup required
- ✅ Free tier is generous
- ✅ Built-in SQL editor for debugging
- ✅ Automatic backups

**Cons:**
- ⚠️ Requires internet connection
- ⚠️ Free tier databases sleep after inactivity (wakes up in ~few seconds)

---

## Option 2: Local PostgreSQL with Docker (Advanced)

**Why:** Fully offline development, faster iteration, no external dependencies.

### Prerequisites:
- Docker installed on your machine
- Basic familiarity with Docker

### Steps:

1. **Create a docker-compose.yml**
   ```bash
   cat > docker-compose.yml <<'EOF'
   version: '3.8'

   services:
     postgres:
       image: postgres:16-alpine
       container_name: meteor-counter-db
       environment:
         POSTGRES_USER: meteor
         POSTGRES_PASSWORD: meteor_dev_password
         POSTGRES_DB: meteor_counter
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
         - ./src/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U meteor"]
         interval: 5s
         timeout: 5s
         retries: 5

   volumes:
     postgres_data:
   EOF
   ```

2. **Start PostgreSQL**
   ```bash
   docker-compose up -d

   # Wait for it to be ready
   docker-compose logs -f postgres
   # Press Ctrl+C when you see "database system is ready to accept connections"
   ```

3. **The schema will be automatically loaded** on first start (via the volume mount)

4. **Create .env file**
   ```bash
   echo "DATABASE_URL=postgresql://meteor:meteor_dev_password@localhost:5432/meteor_counter?sslmode=disable" > .env
   ```

5. **Install and run**
   ```bash
   npm install
   npm run dev
   ```

6. **Test sync** at http://localhost:8888

**Useful Docker commands:**
```bash
# View logs
docker-compose logs -f postgres

# Connect to database with psql
docker-compose exec postgres psql -U meteor -d meteor_counter

# Stop database
docker-compose down

# Stop and remove all data
docker-compose down -v

# Restart database
docker-compose restart
```

**Pros:**
- ✅ Fully offline
- ✅ Fast and consistent
- ✅ Easy to reset/clean
- ✅ No external accounts needed

**Cons:**
- ⚠️ Requires Docker
- ⚠️ Slight difference from production (Neon has some optimizations)

---

## Option 3: Local PostgreSQL (Native Installation)

**Why:** If you already have PostgreSQL installed or prefer native tools.

### Prerequisites:
- PostgreSQL 13+ installed

### macOS:
```bash
# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL
brew services start postgresql@16

# Create database and user
createdb meteor_counter
psql meteor_counter

# In psql:
CREATE USER meteor WITH PASSWORD 'meteor_dev_password';
GRANT ALL PRIVILEGES ON DATABASE meteor_counter TO meteor;
GRANT ALL ON SCHEMA public TO meteor;
\q

# Run schema
psql meteor_counter < src/database/schema.sql
```

### Ubuntu/Debian:
```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql

# Create database and user
sudo -u postgres createdb meteor_counter
sudo -u postgres psql

# In psql:
CREATE USER meteor WITH PASSWORD 'meteor_dev_password';
GRANT ALL PRIVILEGES ON DATABASE meteor_counter TO meteor;
ALTER DATABASE meteor_counter OWNER TO meteor;
\q

# Run schema
sudo -u postgres psql meteor_counter < src/database/schema.sql
```

### Windows:
```bash
# Download from https://www.postgresql.org/download/windows/
# Install and use pgAdmin to:
# 1. Create database "meteor_counter"
# 2. Create user "meteor" with password
# 3. Run schema.sql using Query Tool
```

### Setup .env:
```bash
echo "DATABASE_URL=postgresql://meteor:meteor_dev_password@localhost:5432/meteor_counter" > .env
```

### Run:
```bash
npm install
npm run dev
```

**Pros:**
- ✅ Native performance
- ✅ Full PostgreSQL tooling available
- ✅ Offline development

**Cons:**
- ⚠️ More setup required
- ⚠️ Persists between sessions (no easy reset)

---

## Troubleshooting

### "DATABASE_URL environment variable is not set"
```bash
# Make sure .env exists
cat .env

# If using Netlify Dev, it should auto-load .env
# If not working, try:
source .env && npm run dev
```

### "Connection refused" or "ECONNREFUSED"
```bash
# Check if PostgreSQL is running:

# Docker:
docker-compose ps

# Native (macOS):
brew services list | grep postgresql

# Native (Linux):
sudo systemctl status postgresql

# Test connection:
psql "your-connection-string-here"
```

### Schema errors / tables don't exist
```bash
# Re-run schema:
psql "your-connection-string-here" < src/database/schema.sql

# Or manually:
psql "your-connection-string-here"
\i src/database/schema.sql
\q
```

### Netlify Functions not working locally
```bash
# Make sure you're using netlify dev, not just a static server:
npm run dev

# Not this:
python -m http.server 8000  # Won't work!
```

### "Cannot find module '@neondatabase/serverless'"
```bash
# Install dependencies:
npm install

# Check that node_modules exists:
ls -la node_modules/@neondatabase/
```

### Database "sleeps" (Neon free tier)
- First query after sleep takes ~2-3 seconds to wake up
- This is normal for Neon's free tier
- Use Docker for instant responses during development

---

## Viewing Your Data

### Using psql:
```bash
# Connect
psql "your-connection-string-here"

# View sessions
SELECT id, start_time, end_time, total_observations, location_privacy FROM sessions ORDER BY start_time DESC LIMIT 10;

# View observations for a session
SELECT * FROM observations WHERE session_id = 'your-session-uuid';

# Count everything
SELECT
  (SELECT COUNT(*) FROM sessions) as total_sessions,
  (SELECT COUNT(*) FROM observations) as total_observations;

# Check sync statistics
SELECT * FROM session_stats ORDER BY start_time DESC LIMIT 5;
```

### Using Neon Dashboard:
1. Go to https://console.neon.tech
2. Select your project
3. Click "Tables" in sidebar
4. Click "SQL Editor"
5. Run queries

### Using a GUI Tool:
- **pgAdmin**: https://www.pgadmin.org/
- **DBeaver**: https://dbeaver.io/
- **TablePlus**: https://tableplus.com/
- **Postico** (macOS): https://eggerapps.at/postico/

Just use your DATABASE_URL connection string!

---

## Reset Database

### Drop all data:
```bash
psql "your-connection-string-here" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "your-connection-string-here" < src/database/schema.sql
```

### Or just observations:
```bash
psql "your-connection-string-here" -c "TRUNCATE observations, sessions RESTART IDENTITY CASCADE;"
```

---

## Testing the Full Workflow

1. **Start local dev server**
   ```bash
   npm run dev
   ```

2. **Open app** at http://localhost:8888

3. **Create test data**
   - Enable location (or skip)
   - Start observing
   - Record a few test "meteors"
   - Stop session

4. **Check sync status**
   - Should show "1 session(s) need syncing"

5. **Open Sync Settings**
   - See your device ID
   - Choose privacy level
   - Click "Sync All Data"

6. **Verify in database**
   ```bash
   psql "your-connection-string-here" -c "SELECT * FROM sessions;"
   ```

7. **Test subsequent sync**
   - Modify the session (add notes)
   - Sync again
   - Verify `updated_at` changed but IDs stayed the same

8. **Test privacy levels**
   - Create sessions with different privacy settings
   - Check `location_latitude` precision in database:
     - Full: 8 decimals (e.g., 40.71280000)
     - Obfuscated: 2 decimals (e.g., 40.71)
     - Hidden: NULL

---

## My Recommendation

**For quick testing:** Use **Option 1 (Neon Free Tier)**
- 2 minute setup
- No local installation
- Matches production exactly

**For serious development:** Use **Option 2 (Docker)**
- Fully offline
- Fast and reliable
- Easy to reset and experiment
- Can run schema migrations easily

**If you already have PostgreSQL:** Use **Option 3 (Native)**
- Uses existing setup
- Native performance

---

## Next Steps

Once you have it working locally:
1. Test all privacy levels
2. Test sync → modify → sync workflow
3. Test ID reconciliation by checking `remoteId` fields
4. Verify observations are linked to correct sessions
5. Test with multiple sessions
6. Test error handling (disconnect network)

Happy developing! 🚀
