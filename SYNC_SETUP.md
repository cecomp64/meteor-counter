# Remote Database Sync Setup Guide

This guide explains how to set up the remote database synchronization feature for Meteor Observer.

## Overview

The sync feature allows users to:
- Back up their meteor observations to a centralized Neon PostgreSQL database
- Sync data across multiple devices
- Control location privacy (full precision, obfuscated, or hidden)
- Maintain local data even without internet connection

## Architecture

- **Local Storage**: IndexedDB for offline-first operation
- **Remote Database**: Neon PostgreSQL (serverless)
- **API Layer**: Netlify Functions for backend
- **Sync Strategy**: Unidirectional (local → remote) with ID reconciliation

## Setup Instructions

### 1. Create a Neon Database

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up or log in
3. Create a new project
4. Create a new database (or use the default)
5. Copy your connection string (it looks like: `postgresql://user:password@host/database?sslmode=require`)

### 2. Initialize the Database Schema

Connect to your Neon database and run the SQL schema:

```bash
psql "postgresql://user:password@host/database?sslmode=require" < schema.sql
```

Or copy the contents of `schema.sql` and run it in the Neon SQL Editor.

### 3. Configure Netlify

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Neon connection string:
   ```
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```

4. Deploy to Netlify:
   ```bash
   # First time setup
   netlify init

   # Deploy
   netlify deploy --prod
   ```

5. Set environment variables in Netlify:
   - Go to your Netlify site settings
   - Navigate to "Environment variables"
   - Add `DATABASE_URL` with your Neon connection string

### 4. Test the Setup

1. Open the deployed app
2. Create a test observation session
3. Go to "Sync Settings"
4. Click "Sync All Data"
5. Check your Neon database to verify the data was synced

## How Sync Works

### ID Reconciliation

The sync system handles local and remote IDs intelligently:

1. **First Sync** (`syncStatus: 'unsynced'`):
   - Local session/observation is assigned a temporary auto-incrementing ID
   - When first synced to remote, it receives a UUID from PostgreSQL
   - Local record is updated with `remoteId` field
   - `syncStatus` changes to 'synced'
   - `lastSyncedAt` timestamp is recorded

2. **Subsequent Syncs** (`syncStatus: 'modified'`):
   - Local ID remains unchanged
   - Remote record is updated using the stored `remoteId`
   - No ID reconciliation occurs

3. **State Tracking**:
   - `unsynced`: Never been synced to remote
   - `synced`: Exists in remote and hasn't changed locally
   - `modified`: Exists in remote but has local changes

### Location Privacy

Three privacy levels are supported:

1. **Full Precision**: Exact GPS coordinates (best for science)
2. **Obfuscated**: Rounded to ~1km precision (balance privacy/utility)
3. **Hidden**: No location data shared

Privacy settings are applied at sync time, so you can change them retroactively.

## API Endpoints

### POST /api/sync-session
Syncs a session and its observations to the remote database.

**Request:**
```json
{
  "localSessionId": 123,
  "remoteSessionId": "uuid-or-null",
  "startTime": "2025-12-14T10:00:00Z",
  "endTime": "2025-12-14T11:00:00Z",
  "duration": 3600000,
  "totalObservations": 5,
  "notes": "Clear sky",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  },
  "locationPrivacy": "full",
  "deviceId": "device-uuid",
  "observations": [...]
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "localId": 123,
    "remoteId": "uuid",
    "isNew": true
  },
  "observations": [
    {
      "localId": 1,
      "remoteId": "uuid"
    }
  ]
}
```

### GET /api/get-sessions
Retrieves sessions for a device.

**Query Parameters:**
- `deviceId`: Filter by device
- `limit`: Max results (default: 100)
- `offset`: Pagination offset

### GET /api/get-session-details
Gets full session details including observations.

**Query Parameters:**
- `sessionId`: The remote session UUID

## Database Schema

### sessions table
- `id`: UUID primary key
- `start_time`, `end_time`: Timestamps
- `duration`: Milliseconds
- `total_observations`: Count
- `notes`: Text
- `location_*`: Location fields with privacy support
- `device_id`: Device identifier
- `created_at`, `updated_at`: Metadata

### observations table
- `id`: UUID primary key
- `session_id`: Foreign key to sessions
- `timestamp`: When the meteor was observed
- `duration`: How long the press was held
- `intensity`: Calculated from movement
- `location_*`: Optional location fields

## Security Considerations

1. **Anonymous by Default**: No user authentication required
2. **Device-based**: Each device gets a unique ID
3. **Privacy Controls**: Users control location sharing
4. **No PII**: System doesn't collect personal information
5. **SSL Required**: All connections use HTTPS

## Troubleshooting

### Sync fails with network error
- Check your internet connection
- Verify DATABASE_URL is set in Netlify environment variables
- Check Netlify function logs for errors

### Data not appearing in database
- Run the schema.sql file to ensure tables exist
- Check that DATABASE_URL has `?sslmode=require` at the end
- Verify Neon database is not in sleep mode

### IDs not reconciling
- Check browser console for sync errors
- Verify `remoteId` field exists in IndexedDB
- Check that database version is 2 (with sync fields)

## Development

Run locally with Netlify Dev:

```bash
netlify dev
```

This will start the app at http://localhost:8888 with functions available.

## Future Enhancements

- [ ] Bi-directional sync (pull remote changes)
- [ ] User authentication
- [ ] Conflict resolution
- [ ] Batch sync optimization
- [ ] Offline queue management
- [ ] Public observation viewer/map
