// Sync service for remote database synchronization
class SyncService {
    constructor(db) {
        this.db = db;
        this.apiBase = this.detectApiBase();
        this.deviceId = this.getOrCreateDeviceId();
        this.syncInProgress = false;
    }

    // Detect the correct API base URL based on environment
    detectApiBase() {
        // Use relative path for all environments
        // In development:
        //   - Port 3000: server.js proxies to Netlify Dev (8889)
        //   - Port 8888: proxy.js forwards to Netlify Dev (8889)
        //   - Port 8889: Netlify Dev directly
        // In production:
        //   - Netlify handles the routing automatically

        const currentPort = window.location.port;
        console.log(`Detected port ${currentPort || 'default'}, using /.netlify/functions`);
        console.log('API endpoint: /.netlify/functions');

        return '/.netlify/functions';
    }

    // Get or create a unique device ID
    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('meteor-observer-device-id');
        if (!deviceId) {
            deviceId = this.generateUUID();
            localStorage.setItem('meteor-observer-device-id', deviceId);
        }
        return deviceId;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Main sync function
    async syncToRemote(locationPrivacy = 'full') {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        this.syncInProgress = true;
        const results = {
            synced: 0,
            failed: 0,
            errors: []
        };

        try {
            // Get all unsynced/modified sessions
            const unsyncedSessions = await this.db.getUnsyncedSessions();
            console.log(`Found ${unsyncedSessions.length} sessions to sync`);

            for (const session of unsyncedSessions) {
                try {
                    await this.syncSession(session, locationPrivacy);
                    results.synced++;
                } catch (error) {
                    console.error(`Failed to sync session ${session.id}:`, error);
                    results.failed++;
                    results.errors.push({
                        sessionId: session.id,
                        error: error.message
                    });
                }
            }

            return results;
        } finally {
            this.syncInProgress = false;
        }
    }

    // Sync a single session with its observations
    async syncSession(session, locationPrivacy) {
        console.log(`Syncing session ${session.id}, status: ${session.syncStatus}`);

        // Get observations for this session
        const observations = await this.db.getObservationsBySession(session.id);
        console.log(`  Found ${observations.length} observations`);

        // Determine if this is a first-time sync (no remoteId)
        const isFirstSync = !session.remoteId;

        // Prepare session data for sync
        const sessionData = {
            localSessionId: session.id,
            remoteSessionId: session.remoteId || null,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            totalObservations: session.totalObservations || observations.length,
            notes: session.notes || '',
            location: session.location,
            locationPrivacy: locationPrivacy,
            deviceId: this.deviceId,
            observations: observations.map(obs => ({
                localId: obs.id,
                remoteId: obs.remoteId || null,
                timestamp: obs.timestamp,
                duration: obs.duration,
                intensity: obs.intensity,
                location: obs.location
            }))
        };

        // Call sync API
        const response = await fetch(`${this.apiBase}/sync-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            // Try to parse error as JSON, but handle non-JSON responses (like 404 HTML)
            let errorMessage = `Sync failed with status ${response.status}`;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    // JSON parse failed, use default message
                }
            } else if (response.status === 404) {
                errorMessage = 'Sync endpoint not found. Make sure you are running via "npm run dev" (port 8888) or "node server.js" + Netlify Dev (port 3000).';
            } else if (response.status === 503) {
                errorMessage = 'Netlify functions unavailable. Make sure Netlify Dev is running on port 8889.';
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Sync response:', result);

        // Update local database with remote IDs
        // ONLY reconcile IDs if this was the first sync
        if (isFirstSync) {
            console.log('First sync - updating local IDs with remote IDs');
            await this.db.markSessionSynced(session.id, result.session.remoteId);

            // Update observation IDs
            for (const obsMapping of result.observations) {
                await this.db.markObservationSynced(obsMapping.localId, obsMapping.remoteId);
            }
        } else {
            console.log('Subsequent sync - keeping existing IDs, just updating sync status');
            // Just update sync status, don't change IDs
            await this.db.updateSession(session.id, {
                syncStatus: 'synced',
                lastSyncedAt: new Date().toISOString()
            });

            // Update observation sync status
            for (const obs of observations) {
                if (obs.syncStatus !== 'synced') {
                    await this.db.updateObservation(obs.id, {
                        syncStatus: 'synced',
                        lastSyncedAt: new Date().toISOString()
                    });
                }
            }
        }

        return result;
    }

    // Get sync status for display
    async getSyncStatus() {
        const unsyncedSessions = await this.db.getUnsyncedSessions();
        const unsyncedObservations = await this.db.getUnsyncedObservations();

        // Count by status
        const sessionStats = {
            unsynced: 0,
            modified: 0
        };

        const observationStats = {
            unsynced: 0,
            modified: 0
        };

        unsyncedSessions.forEach(s => {
            sessionStats[s.syncStatus] = (sessionStats[s.syncStatus] || 0) + 1;
        });

        unsyncedObservations.forEach(o => {
            observationStats[o.syncStatus] = (observationStats[o.syncStatus] || 0) + 1;
        });

        return {
            sessions: sessionStats,
            observations: observationStats,
            totalUnsynced: unsyncedSessions.length,
            hasUnsyncedData: unsyncedSessions.length > 0 || unsyncedObservations.length > 0
        };
    }

    // Fetch remote sessions for this device
    async fetchRemoteSessions() {
        const response = await fetch(`${this.apiBase}/get-sessions?deviceId=${this.deviceId}`);

        if (!response.ok) {
            let errorMessage = `Failed to fetch sessions (status ${response.status})`;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    // JSON parse failed, use default message
                }
            } else if (response.status === 404) {
                errorMessage = 'API endpoint not found. Make sure you are running via "npm run dev" (port 8888) or "node server.js" + Netlify Dev (port 3000).';
            } else if (response.status === 503) {
                errorMessage = 'Netlify functions unavailable. Make sure Netlify Dev is running on port 8889.';
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result.sessions;
    }

    // Get details for a specific remote session
    async fetchSessionDetails(sessionId) {
        const response = await fetch(`${this.apiBase}/get-session-details?sessionId=${sessionId}`);

        if (!response.ok) {
            let errorMessage = `Failed to fetch session details (status ${response.status})`;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    // JSON parse failed, use default message
                }
            } else if (response.status === 404) {
                errorMessage = 'API endpoint not found. Make sure you are running via "npm run dev" (port 8888) or "node server.js" + Netlify Dev (port 3000).';
            } else if (response.status === 503) {
                errorMessage = 'Netlify functions unavailable. Make sure Netlify Dev is running on port 8889.';
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result.session;
    }

    // Test connection to remote database
    async testConnection() {
        try {
            const response = await fetch(`${this.apiBase}/get-sessions?deviceId=${this.deviceId}&limit=1`);
            return response.ok;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}

// Export for use in app.js
window.SyncService = SyncService;
