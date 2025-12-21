// IndexedDB wrapper for meteor observations
class MeteorDB {
    constructor() {
        this.dbName = 'MeteorObserverDB';
        this.version = 2; // Increased for sync fields
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // Create or upgrade observations store
                let observationStore;
                if (!db.objectStoreNames.contains('observations')) {
                    observationStore = db.createObjectStore('observations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    observationStore.createIndex('sessionId', 'sessionId', { unique: false });
                    observationStore.createIndex('timestamp', 'timestamp', { unique: false });
                } else {
                    observationStore = transaction.objectStore('observations');
                }

                // Add sync tracking index if needed
                if (!observationStore.indexNames.contains('remoteId')) {
                    observationStore.createIndex('remoteId', 'remoteId', { unique: false });
                }
                if (!observationStore.indexNames.contains('syncStatus')) {
                    observationStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                // Create or upgrade sessions store
                let sessionStore;
                if (!db.objectStoreNames.contains('sessions')) {
                    sessionStore = db.createObjectStore('sessions', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    sessionStore.createIndex('startTime', 'startTime', { unique: false });
                } else {
                    sessionStore = transaction.objectStore('sessions');
                }

                // Add sync tracking indexes if needed
                if (!sessionStore.indexNames.contains('remoteId')) {
                    sessionStore.createIndex('remoteId', 'remoteId', { unique: false });
                }
                if (!sessionStore.indexNames.contains('syncStatus')) {
                    sessionStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }
            };
        });
    }

    async saveObservation(observation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['observations'], 'readwrite');
            const store = transaction.objectStore('observations');

            // Add sync tracking fields if not present
            const obsWithSync = {
                ...observation,
                remoteId: observation.remoteId || null,
                syncStatus: observation.syncStatus || 'unsynced', // 'unsynced', 'synced', 'modified'
                lastSyncedAt: observation.lastSyncedAt || null
            };

            const request = store.add(obsWithSync);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveSession(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');

            // Add sync tracking fields if not present
            const sessionWithSync = {
                ...session,
                remoteId: session.remoteId || null,
                syncStatus: session.syncStatus || 'unsynced', // 'unsynced', 'synced', 'modified'
                lastSyncedAt: session.lastSyncedAt || null,
                locationPrivacy: session.locationPrivacy || 'full' // 'full', 'obfuscated', 'hidden'
            };

            const request = store.add(sessionWithSync);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateSession(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const session = getRequest.result;

                // If session was previously synced and is being modified, mark as modified
                if (session.syncStatus === 'synced' && !updates.syncStatus) {
                    updates.syncStatus = 'modified';
                }

                Object.assign(session, updates);
                const updateRequest = store.put(session);

                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getObservationsBySession(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['observations'], 'readonly');
            const store = transaction.objectStore('observations');
            const index = store.index('sessionId');
            const request = index.getAll(sessionId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSession(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSessions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['observations', 'sessions'], 'readwrite');

            const obsStore = transaction.objectStore('observations');
            const sessStore = transaction.objectStore('sessions');

            const clearObs = obsStore.clear();
            const clearSess = sessStore.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Sync-related methods

    async getUnsyncedSessions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const index = store.index('syncStatus');
            const results = [];

            // Get both unsynced and modified sessions
            const unsyncedRequest = index.getAll('unsynced');
            const modifiedRequest = index.getAll('modified');

            let completed = 0;

            unsyncedRequest.onsuccess = () => {
                results.push(...unsyncedRequest.result);
                if (++completed === 2) resolve(results);
            };

            modifiedRequest.onsuccess = () => {
                results.push(...modifiedRequest.result);
                if (++completed === 2) resolve(results);
            };

            unsyncedRequest.onerror = () => reject(unsyncedRequest.error);
            modifiedRequest.onerror = () => reject(modifiedRequest.error);
        });
    }

    async getUnsyncedObservations() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['observations'], 'readonly');
            const store = transaction.objectStore('observations');
            const index = store.index('syncStatus');
            const results = [];

            const unsyncedRequest = index.getAll('unsynced');
            const modifiedRequest = index.getAll('modified');

            let completed = 0;

            unsyncedRequest.onsuccess = () => {
                results.push(...unsyncedRequest.result);
                if (++completed === 2) resolve(results);
            };

            modifiedRequest.onsuccess = () => {
                results.push(...modifiedRequest.result);
                if (++completed === 2) resolve(results);
            };

            unsyncedRequest.onerror = () => reject(unsyncedRequest.error);
            modifiedRequest.onerror = () => reject(modifiedRequest.error);
        });
    }

    async updateObservation(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['observations'], 'readwrite');
            const store = transaction.objectStore('observations');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const observation = getRequest.result;

                // If observation was previously synced and is being modified, mark as modified
                if (observation.syncStatus === 'synced' && !updates.syncStatus) {
                    updates.syncStatus = 'modified';
                }

                Object.assign(observation, updates);
                const updateRequest = store.put(observation);

                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async markSessionSynced(localId, remoteId) {
        return this.updateSession(localId, {
            remoteId: remoteId,
            syncStatus: 'synced',
            lastSyncedAt: new Date().toISOString()
        });
    }

    async markObservationSynced(localId, remoteId) {
        return this.updateObservation(localId, {
            remoteId: remoteId,
            syncStatus: 'synced',
            lastSyncedAt: new Date().toISOString()
        });
    }
}

// Export for use in app.js
window.MeteorDB = MeteorDB;
