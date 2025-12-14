// IndexedDB wrapper for meteor observations
class MeteorDB {
    constructor() {
        this.dbName = 'MeteorObserverDB';
        this.version = 1;
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

                // Create observations store
                if (!db.objectStoreNames.contains('observations')) {
                    const observationStore = db.createObjectStore('observations', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    observationStore.createIndex('sessionId', 'sessionId', { unique: false });
                    observationStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create sessions store
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    sessionStore.createIndex('startTime', 'startTime', { unique: false });
                }
            };
        });
    }

    async saveObservation(observation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['observations'], 'readwrite');
            const store = transaction.objectStore('observations');
            const request = store.add(observation);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveSession(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.add(session);

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
}

// Export for use in app.js
window.MeteorDB = MeteorDB;
