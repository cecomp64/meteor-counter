/**
 * Authentication Service
 * Handles user registration, login, logout, and token management
 */
class AuthService {
    constructor() {
        this.token = null;
        this.user = null;
        this.loadFromStorage();
    }

    /**
     * Load authentication data from localStorage
     */
    loadFromStorage() {
        try {
            const token = localStorage.getItem('meteor-observer-auth-token');
            const userJson = localStorage.getItem('meteor-observer-user');

            if (token && userJson) {
                this.token = token;
                this.user = JSON.parse(userJson);
            }
        } catch (error) {
            console.error('Error loading auth from storage:', error);
            this.clearAuth();
        }
    }

    /**
     * Save authentication data to localStorage
     */
    saveToStorage() {
        if (this.token && this.user) {
            localStorage.setItem('meteor-observer-auth-token', this.token);
            localStorage.setItem('meteor-observer-user', JSON.stringify(this.user));
        }
    }

    /**
     * Clear authentication data
     */
    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('meteor-observer-auth-token');
        localStorage.removeItem('meteor-observer-user');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.token && this.user);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Get auth token
     */
    getToken() {
        return this.token;
    }

    /**
     * Get auth headers for API requests
     */
    getAuthHeaders() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Register a new user
     */
    async register(email, password, deviceId = null) {
        try {
            const response = await fetch('/.netlify/functions/auth-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Save token and user
            this.token = data.token;
            this.user = data.user;
            this.saveToStorage();

            // Automatically migrate any anonymous sessions from this device
            if (deviceId) {
                await this.migrateDeviceSessions(deviceId);
            }

            return { success: true, user: data.user };

        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Login user
     */
    async login(email, password, deviceId = null) {
        try {
            const response = await fetch('/.netlify/functions/auth-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Save token and user
            this.token = data.token;
            this.user = data.user;
            this.saveToStorage();

            // Automatically migrate any anonymous sessions from this device
            if (deviceId) {
                await this.migrateDeviceSessions(deviceId);
            }

            return { success: true, user: data.user };

        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verify current token
     */
    async verify() {
        if (!this.token) {
            return { valid: false, error: 'No token' };
        }

        try {
            const response = await fetch('/.netlify/functions/auth-verify', {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (!response.ok || !data.valid) {
                // Token is invalid, clear auth
                this.clearAuth();
                return { valid: false, error: data.error || 'Invalid token' };
            }

            // Update user data
            this.user = data.user;
            this.saveToStorage();

            return { valid: true, user: data.user };

        } catch (error) {
            console.error('Token verification error:', error);
            this.clearAuth();
            return { valid: false, error: error.message };
        }
    }

    /**
     * Logout user
     */
    logout() {
        this.clearAuth();
        return { success: true };
    }

    /**
     * Migrate anonymous sessions to user account
     * This will update all device-only sessions to be associated with the user
     * Called automatically after login/register
     */
    async migrateDeviceSessions(deviceId) {
        if (!this.isAuthenticated()) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!deviceId) {
            return { success: false, error: 'Device ID required' };
        }

        try {
            const response = await fetch('/.netlify/functions/migrate-device-sessions', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ deviceId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Migration failed');
            }

            console.log(`Migration complete: ${data.migratedCount} session(s) linked to account`);
            return { success: true, migratedCount: data.migratedCount };

        } catch (error) {
            console.error('Migration error:', error);
            // Don't fail the login/register if migration fails
            // Just log it and continue
            return { success: false, error: error.message };
        }
    }
}
