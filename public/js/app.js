// Main application logic
class MeteorObserver {
    constructor() {
        this.db = new MeteorDB();
        this.authService = new AuthService();
        this.syncService = null; // Will be initialized after DB
        this.currentSession = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.location = null;
        this.observations = [];
        this.viewingPastSession = false; // Track if viewing historical data

        // Auth UI state
        this.authMode = 'login'; // 'login' or 'signup'

        // Touch tracking
        this.touchStart = null;
        this.touchStartPos = null;
        this.touchMovement = 0;
        this.isRecording = false;

        // Practice mode
        this.practiceMode = false;
        this.currentPracticeMeteor = null;
        this.practiceScore = { correct: 0, total: 0, accuracySum: 0 };
        this.waitingForNextMeteor = false;

        // Canvas for visual feedback
        this.canvas = null;
        this.ctx = null;

        // Audio context for sound (needs user gesture to initialize)
        this.audioContext = null;

        // Store bound handlers so we can remove them
        this.boundHandlers = {
            mouseDown: null,
            mouseMove: null,
            mouseUp: null,
            mouseLeave: null,
            touchStart: null,
            touchMove: null,
            touchEnd: null
        };

        this.init();
    }

    async init() {
        await this.db.init();
        this.syncService = new SyncService(this.db, this.authService);
        this.setupEventListeners();
        this.registerServiceWorker();
        await this.verifyAuthToken();
        await this.updateSyncStatus();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.error('Service Worker registration failed:', err));
        }
    }

    setupEventListeners() {
        // Location screen
        document.getElementById('request-location-btn').addEventListener('click', () => {
            this.requestLocation();
        });
        
        document.getElementById('skip-location-btn').addEventListener('click', () => {
            console.log('Location skipped');
            this.showScreen('ready-screen');
        });

        // Ready screen
        document.getElementById('start-observing-btn').addEventListener('click', () => {
            this.startObserving(false); // normal mode
        });

        document.getElementById('start-practice-btn').addEventListener('click', () => {
            this.startObserving(true); // practice mode
        });

        document.getElementById('view-past-sessions-btn').addEventListener('click', () => {
            this.showPastSessions();
        });

        // Past sessions screen
        document.getElementById('back-to-ready-btn').addEventListener('click', () => {
            this.showScreen('ready-screen');
        });

        // Observing screen
        document.getElementById('stop-observing-btn').addEventListener('click', () => {
            this.stopObserving();
        });

        // Results screen
        document.getElementById('download-report-btn').addEventListener('click', () => {
            this.downloadReport();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('new-session-btn').addEventListener('click', () => {
            this.newSession();
        });

        document.getElementById('back-to-sessions-btn').addEventListener('click', () => {
            this.showPastSessions();
        });

        document.getElementById('save-notes-btn').addEventListener('click', () => {
            this.saveSessionNotes();
        });

        // Sync controls
        document.getElementById('sync-settings-btn').addEventListener('click', () => {
            this.showSyncSettings();
        });

        document.getElementById('back-to-ready-from-sync-btn').addEventListener('click', () => {
            this.showScreen('ready-screen');
        });

        document.getElementById('sync-all-btn').addEventListener('click', () => {
            this.syncAllData();
        });

        document.getElementById('sync-now-btn').addEventListener('click', () => {
            this.syncAllData();
        });

        // Save location privacy preference
        document.querySelectorAll('input[name="location-privacy"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                localStorage.setItem('location-privacy', e.target.value);
            });
        });

        // Auth controls
        document.getElementById('auth-action-btn').addEventListener('click', () => {
            this.handleAuthAction();
        });

        document.getElementById('auth-submit-btn').addEventListener('click', () => {
            this.handleAuthSubmit();
        });

        document.getElementById('auth-toggle-mode-btn').addEventListener('click', () => {
            this.toggleAuthMode();
        });

        document.getElementById('back-to-sync-from-auth-btn').addEventListener('click', () => {
            this.showScreen('sync-settings-screen');
        });

        // Account screen
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        document.getElementById('back-to-sync-from-account-btn').addEventListener('click', () => {
            this.showScreen('sync-settings-screen');
        });

        // Enter key in auth form
        document.getElementById('auth-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAuthSubmit();
            }
        });
    }

    async requestLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            this.showScreen('ready-screen');
            return;
        }

        const btn = document.getElementById('request-location-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split btn-icon"></i> Getting Location...';

        try {
            const position = await new Promise((resolve, reject) => {
                const options = {
                    enableHighAccuracy: false, // Faster on mobile
                    timeout: 10000, // 10 second timeout
                    maximumAge: 300000 // Accept cached position up to 5 minutes old
                };
                
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });

            this.location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            document.getElementById('location-display').textContent = 
                `Location: ${this.location.latitude.toFixed(4)}°, ${this.location.longitude.toFixed(4)}°`;
            
            console.log('Location obtained:', this.location);
            this.showScreen('ready-screen');
            
        } catch (error) {
            console.error('Location error:', error);
            
            let errorMessage = 'Could not get location. ';
            
            if (error.code === 1) { // PERMISSION_DENIED
                errorMessage += 'Location permission denied. You can enable it in Settings > Safari > Location Services.';
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                errorMessage += 'Location information unavailable.';
            } else if (error.code === 3) { // TIMEOUT
                errorMessage += 'Location request timed out.';
            } else {
                errorMessage += error.message || 'Unknown error.';
            }
            
            errorMessage += '\n\nYou can still use the app without location.';
            
            alert(errorMessage);
            this.showScreen('ready-screen');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-geo-alt-fill btn-icon"></i> Enable Location';
        }
    }

    async startObserving(isPracticeMode = false) {
        // Clean up any previous session state
        this.cleanupObservingSession();

        // Set practice mode
        this.practiceMode = isPracticeMode;

        // Initialize AudioContext on user gesture (required for mobile)
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext created');
            } catch (e) {
                console.error('Failed to create AudioContext:', e);
            }
        }

        // Resume AudioContext if it's suspended (required on iOS)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('AudioContext resumed');
            } catch (e) {
                console.error('Failed to resume AudioContext:', e);
            }
        }

        this.sessionStartTime = new Date();
        this.observations = [];
        this.isRecording = false;
        this.touchStart = null;
        this.touchStartPos = null;
        this.touchMovement = 0;

        // Reset practice score if in practice mode
        if (isPracticeMode) {
            this.practiceScore = { correct: 0, total: 0, accuracySum: 0 };
        }

        // Create session in database
        const session = {
            startTime: this.sessionStartTime.toISOString(),
            location: this.location,
            observations: [],
            notes: '',
            isPractice: isPracticeMode
        };

        this.currentSession = await this.db.saveSession(session);

        // Update sync status since we created new data
        await this.updateSyncStatus();

        // Update UI
        document.getElementById('session-start-time').textContent =
            `Started ${this.sessionStartTime.toLocaleTimeString()}`;
        document.getElementById('meteor-count').textContent = '0';
        document.getElementById('meteors-per-hour').textContent = '0.0';

        // Hide last observation info initially
        document.getElementById('last-obs-count').style.display = 'none';
        document.getElementById('last-obs-rate').style.display = 'none';

        // Show/hide practice mode controls
        const practiceModePanel = document.getElementById('practice-mode-panel');
        if (isPracticeMode) {
            practiceModePanel.style.display = 'block';
        } else {
            practiceModePanel.style.display = 'none';
        }

        // Setup canvas
        this.canvas = document.getElementById('visual-feedback');
        this.ctx = this.canvas.getContext('2d');

        // Setup touch area listeners
        this.setupTouchArea();

        // Start timer
        this.startSessionTimer();

        // Play ascending chime to signal session start
        setTimeout(() => {
            console.log('Playing session start chime');
            this.playChime(true); // Ascending pitch
        }, 300);

        this.showScreen('observing-screen');

        // Resize canvas and start practice meteors AFTER screen is shown
        setTimeout(() => {
            this.resizeCanvas();
            if (isPracticeMode) {
                // Generate first meteor after a short delay
                setTimeout(() => {
                    this.generatePracticeMeteor();
                }, 1500);
            }
        }, 100);
    }

    resizeCanvas() {
        const touchArea = document.getElementById('touch-area');
        this.canvas.width = touchArea.clientWidth;
        this.canvas.height = touchArea.clientHeight;
    }

    setupTouchArea() {
        const touchArea = document.getElementById('touch-area');
        
        // Remove any existing handlers first
        this.removeTouchAreaHandlers();
        
        // Create bound handlers
        this.boundHandlers.mouseDown = (e) => this.handleTouchStart(e);
        this.boundHandlers.mouseMove = (e) => this.handleTouchMove(e);
        this.boundHandlers.mouseUp = (e) => this.handleTouchEnd(e);
        this.boundHandlers.mouseLeave = (e) => {
            if (this.isRecording) this.handleTouchEnd(e);
        };
        this.boundHandlers.touchStart = (e) => {
            e.preventDefault();
            this.handleTouchStart(e.touches[0]);
        };
        this.boundHandlers.touchMove = (e) => {
            e.preventDefault();
            this.handleTouchMove(e.touches[0]);
        };
        this.boundHandlers.touchEnd = (e) => {
            e.preventDefault();
            this.handleTouchEnd(e.changedTouches[0]);
        };
        
        // Add event listeners
        touchArea.addEventListener('mousedown', this.boundHandlers.mouseDown);
        touchArea.addEventListener('mousemove', this.boundHandlers.mouseMove);
        touchArea.addEventListener('mouseup', this.boundHandlers.mouseUp);
        touchArea.addEventListener('mouseleave', this.boundHandlers.mouseLeave);
        touchArea.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
        touchArea.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
        touchArea.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: false });
    }
    
    removeTouchAreaHandlers() {
        const touchArea = document.getElementById('touch-area');
        if (!touchArea) return;
        
        // Remove all handlers if they exist
        if (this.boundHandlers.mouseDown) {
            touchArea.removeEventListener('mousedown', this.boundHandlers.mouseDown);
            touchArea.removeEventListener('mousemove', this.boundHandlers.mouseMove);
            touchArea.removeEventListener('mouseup', this.boundHandlers.mouseUp);
            touchArea.removeEventListener('mouseleave', this.boundHandlers.mouseLeave);
            touchArea.removeEventListener('touchstart', this.boundHandlers.touchStart);
            touchArea.removeEventListener('touchmove', this.boundHandlers.touchMove);
            touchArea.removeEventListener('touchend', this.boundHandlers.touchEnd);
        }
    }
    
    cleanupObservingSession() {
        // Clear timer if running
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }

        // Reset practice mode state
        this.practiceMode = false;
        this.currentPracticeMeteor = null;
        this.waitingForNextMeteor = false;

        // Remove touch area handlers
        this.removeTouchAreaHandlers();

        // Clear canvas
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Reset recording state
        this.isRecording = false;
        this.touchStart = null;
        this.touchStartPos = null;
        this.touchMovement = 0;
    }

    handleTouchStart(e) {
        this.isRecording = true;
        this.touchStart = Date.now();
        this.touchStartPos = { x: e.clientX, y: e.clientY };
        this.touchMovement = 0;
    }

    handleTouchMove(e) {
        if (!this.isRecording) return;

        const dx = e.clientX - this.touchStartPos.x;
        const dy = e.clientY - this.touchStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.touchMovement = Math.max(this.touchMovement, distance);
    }

    async handleTouchEnd(e) {
        console.log('handleTouchEnd called, isRecording:', this.isRecording);

        if (!this.isRecording) {
            console.log('Not recording, ignoring');
            return;
        }

        // Immediately set to false to prevent re-entry
        this.isRecording = false;
        console.log('Recording stopped, processing observation');

        const duration = Date.now() - this.touchStart;

        // Only record if press was at least 100ms
        if (duration < 100) {
            this.clearCanvas();
            return;
        }

        // Calculate intensity (0-100) based on movement
        const intensity = Math.min(100, Math.round(this.touchMovement / 2));

        // Practice mode scoring and data
        let practiceData = null;
        if (this.practiceMode) {
            console.log('Practice mode active, currentPracticeMeteor:', this.currentPracticeMeteor);
            if (this.currentPracticeMeteor) {
                practiceData = this.calculatePracticeScore(duration, intensity);
                // Schedule next meteor after feedback fades
                this.scheduleNextPracticeMeteor();
            } else {
                console.log('No current practice meteor - user recorded outside meteor window');
                // Still schedule next meteor if user records when no meteor is active
                this.scheduleNextPracticeMeteor();
            }
        }

        // Create observation
        const observation = {
            sessionId: this.currentSession,
            timestamp: new Date().toISOString(),
            duration: duration,
            intensity: intensity,
            location: this.location,
            // Practice mode fields
            actualDuration: practiceData ? practiceData.actualDuration : null,
            actualIntensity: practiceData ? practiceData.actualIntensity : null,
            durationAccuracy: practiceData ? practiceData.durationAccuracy : null,
            intensityAccuracy: practiceData ? practiceData.intensityAccuracy : null,
            overallAccuracy: practiceData ? practiceData.overallAccuracy : null
        };

        // Save to database
        console.log('Saving observation:', observation);
        await this.db.saveObservation(observation);
        this.observations.push(observation);
        console.log('Observation saved, total count:', this.observations.length);

        // Update sync status since we created new data
        await this.updateSyncStatus();

        // Update UI
        this.updateStats();

        // Feedback
        this.playSound();
        this.vibrate();
    }

    drawMeteorStart(x, y) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawMeteorTrail(x, y) {
        this.ctx.fillStyle = 'rgba(77, 168, 255, 0.6)';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#4da8ff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawMeteorComplete() {
        // Create burst effect
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const x = centerX + Math.cos(angle) * 50;
            const y = centerY + Math.sin(angle) * 50;
            
            this.ctx.fillStyle = `rgba(77, 168, 255, ${0.8 - i * 0.05})`;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#4da8ff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    playSound() {
        if (!this.audioContext) {
            console.warn('AudioContext not initialized');
            return;
        }
        
        try {
            // Resume context if needed (can be suspended on iOS)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            
            oscillator.start(now);
            oscillator.stop(now + 0.2);
            
            console.log('Sound played');
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }

    playChime(increasing = true) {
        if (!this.audioContext) {
            console.warn('AudioContext not initialized');
            return;
        }

        try {
            // Resume context if needed (can be suspended on iOS)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            // Define the notes for the chime (C5, E5, G5)
            const notes = increasing ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
            const noteDuration = 0.15; // Duration of each note
            const noteGap = 0.05; // Small gap between notes

            const now = this.audioContext.currentTime;

            notes.forEach((frequency, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                const startTime = now + (index * (noteDuration + noteGap));
                const endTime = startTime + noteDuration;

                // Fade in and out for smooth chime sound
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
                gainNode.gain.linearRampToValueAtTime(0.1, endTime - 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

                oscillator.start(startTime);
                oscillator.stop(endTime);
            });

            console.log(increasing ? 'Ascending chime played' : 'Descending chime played');
        } catch (e) {
            console.error('Error playing chime:', e);
        }
    }

    vibrate() {
        if ('vibrate' in navigator) {
            try {
                const success = navigator.vibrate(50);
                console.log('Vibrate called, success:', success);
            } catch (e) {
                console.error('Error vibrating:', e);
            }
        } else {
            console.warn('Vibration API not supported');
        }
    }

    updateStats() {
        const count = this.observations.length;
        document.getElementById('meteor-count').textContent = count;

        // Calculate meteors per hour
        const sessionDuration = (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60 / 60; // hours
        const mphValue = sessionDuration > 0 ? (count / sessionDuration).toFixed(1) : '0.0';
        document.getElementById('meteors-per-hour').textContent = mphValue;

        // Update last observation info
        if (count > 0) {
            const lastObs = this.observations[this.observations.length - 1];
            const durationSeconds = (lastObs.duration / 1000).toFixed(1);

            document.getElementById('last-duration').textContent = durationSeconds;
            document.getElementById('last-intensity').textContent = lastObs.intensity;
            document.getElementById('last-obs-count').style.display = 'block';

            // Update session duration display
            const sessionMinutes = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000 / 60);
            const sessionSeconds = Math.floor(((Date.now() - this.sessionStartTime.getTime()) / 1000) % 60);
            document.getElementById('session-duration-display').textContent = `${sessionMinutes}m ${sessionSeconds}s`;
            document.getElementById('last-obs-rate').style.display = 'block';
        }
    }

    startSessionTimer() {
        this.sessionTimer = setInterval(() => {
            const elapsed = Date.now() - this.sessionStartTime.getTime();
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('session-timer').textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    async stopObserving() {
        try {
            console.log('Stop observing clicked');

            // Play descending chime to signal session stop
            this.playChime(false); // Descending pitch

            const endTime = new Date();
            const duration = endTime - this.sessionStartTime;

            console.log('Updating session:', this.currentSession);

            // Prepare session update data
            const sessionUpdate = {
                endTime: endTime.toISOString(),
                duration: duration,
                totalObservations: this.observations.length
            };

            // Add practice stats if in practice mode (BEFORE cleanup resets practiceMode)
            console.log('stopObserving - practiceMode:', this.practiceMode);
            console.log('stopObserving - practiceScore:', this.practiceScore);
            if (this.practiceMode && this.practiceScore.total > 0) {
                sessionUpdate.practiceTotalMeteors = this.practiceScore.total;
                sessionUpdate.practiceAvgAccuracy = this.practiceScore.accuracySum / this.practiceScore.total;
                console.log('Adding practice stats to session update:', sessionUpdate);
            }

            // Update session in database
            console.log('Final session update:', sessionUpdate);
            await this.db.updateSession(this.currentSession, sessionUpdate);

            // Clean up the observing session (this resets practiceMode, so must be after saving stats)
            this.cleanupObservingSession();
            
            console.log('Session updated, showing results');
            
            // Mark as current session (not past)
            this.viewingPastSession = false;
            
            // Show results
            await this.showResults();
            
            console.log('Results shown');
        } catch (error) {
            console.error('Error in stopObserving:', error);
            alert('Error stopping session: ' + error.message);
        }
    }

    async showResults() {
        try {
            console.log('showResults called for session:', this.currentSession);

            // Get session data
            const session = await this.db.getSession(this.currentSession);
            console.log('Session retrieved:', session);

            if (!session || !session.endTime) {
                console.error('Invalid session data:', session);
                alert('Error loading session data. Please try again.');
                this.showScreen('ready-screen');
                return;
            }

            // Load observations for this session to ensure we have the correct data
            this.observations = await this.db.getObservationsBySession(this.currentSession);
            console.log('Loaded observations for results:', this.observations.length);

        const duration = new Date(session.endTime) - new Date(session.startTime);
        const hours = duration / 1000 / 60 / 60;
        const mph = this.observations.length > 0 ? (this.observations.length / hours).toFixed(1) : '0.0';

        const avgDuration = this.observations.length > 0
            ? this.observations.reduce((sum, obs) => sum + obs.duration, 0) / this.observations.length / 1000
            : 0;
        const avgIntensity = this.observations.length > 0
            ? this.observations.reduce((sum, obs) => sum + obs.intensity, 0) / this.observations.length
            : 0;

        // Display practice mode stats if this was a practice session, otherwise show regular summary
        if (session.isPractice) {
            // Hide regular summary for practice sessions
            document.getElementById('session-summary-card').style.display = 'none';
            this.displayPracticeStats(session);
        } else {
            // Show regular summary in charts container for non-practice sessions
            document.getElementById('session-summary-content').innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--nebula-blue);">${this.observations.length}</div>
                        <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Total Meteors</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--nebula-purple);">${mph}</div>
                        <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Per Hour</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--meteor-gold);">${avgDuration.toFixed(1)}s</div>
                        <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Avg Duration</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--success-green);">${avgIntensity.toFixed(0)}</div>
                        <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Avg Intensity</div>
                    </div>
                </div>
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.5); text-align: center;">
                    Session: ${new Date(session.startTime).toLocaleTimeString()} - ${new Date(session.endTime).toLocaleTimeString()}
                </div>
            `;
            document.getElementById('session-summary-card').style.display = 'block';
            // Hide practice stats card
            document.getElementById('practice-stats-card').style.display = 'none';
        }

        // Only create charts if there are observations
        if (this.observations.length > 0) {
            console.log('Creating charts for', this.observations.length, 'observations');
            // Show chart cards
            const chartCards = document.querySelectorAll('.charts-container .chart-card canvas');
            chartCards.forEach(card => card.closest('.chart-card').style.display = 'block');
            this.createCharts();
        } else {
            // Hide chart cards when no observations
            console.log('No observations, hiding chart cards');
            const chartCards = document.querySelectorAll('.charts-container .chart-card canvas');
            chartCards.forEach(card => card.closest('.chart-card').style.display = 'none');
        }
        
        console.log('Showing results screen');
        this.showScreen('results-screen');
        
        // Show/hide "Back to Sessions" button based on context
        const backToSessionsBtn = document.getElementById('back-to-sessions-btn');
        backToSessionsBtn.style.display = this.viewingPastSession ? 'flex' : 'none';

        // Load existing notes into textarea
        const notesTextarea = document.getElementById('session-notes');
        notesTextarea.value = session.notes || '';

        console.log('Results screen shown');
        } catch (error) {
            console.error('Error in showResults:', error);
            alert('Error showing results: ' + error.message);
            this.showScreen('ready-screen');
        }
    }

    displayPracticeStats(session) {
        const practiceStatsCard = document.getElementById('practice-stats-card');
        const practiceStatsContent = document.getElementById('practice-stats-content');

        console.log('displayPracticeStats called with session:', session);
        console.log('isPractice:', session.isPractice);
        console.log('practiceTotalMeteors:', session.practiceTotalMeteors);
        console.log('observations:', this.observations);

        // Check if this was a practice session
        if (!session.isPractice) {
            console.log('Not a practice session, hiding card');
            practiceStatsCard.style.display = 'none';
            return;
        }

        // Calculate stats from observations with accuracy data
        const practiceObservations = this.observations.filter(obs => obs.overallAccuracy !== null);
        console.log('Practice observations with accuracy:', practiceObservations);

        if (practiceObservations.length === 0) {
            console.log('No practice observations with accuracy data, hiding card');
            practiceStatsCard.style.display = 'none';
            return;
        }

        // Calculate average accuracies
        const avgOverallAccuracy = session.practiceAvgAccuracy || 0;
        const avgDurationAccuracy = practiceObservations.reduce((sum, obs) => sum + (obs.durationAccuracy || 0), 0) / practiceObservations.length;
        const avgIntensityAccuracy = practiceObservations.reduce((sum, obs) => sum + (obs.intensityAccuracy || 0), 0) / practiceObservations.length;

        // Determine grade and color
        let grade, color;
        if (avgOverallAccuracy >= 90) {
            grade = 'Excellent!';
            color = '#00ff88';
        } else if (avgOverallAccuracy >= 75) {
            grade = 'Great!';
            color = '#ffd700';
        } else if (avgOverallAccuracy >= 60) {
            grade = 'Good';
            color = '#4da8ff';
        } else if (avgOverallAccuracy >= 40) {
            grade = 'Fair';
            color = '#ff6ec7';
        } else {
            grade = 'Keep Practicing';
            color = '#ff4757';
        }

        // Display practice stats
        practiceStatsContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 2.5rem; font-family: 'Orbitron', sans-serif; color: ${color};">${avgOverallAccuracy.toFixed(1)}%</div>
                    <div style="font-size: 1.1rem; color: ${color}; font-weight: bold; margin-top: 5px;">${grade}</div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.5); margin-top: 3px;">Overall Accuracy</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-family: 'Orbitron', sans-serif; color: var(--meteor-gold);">${avgDurationAccuracy.toFixed(1)}%</div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-top: 5px;">Duration Accuracy</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-family: 'Orbitron', sans-serif; color: var(--nebula-blue);">${avgIntensityAccuracy.toFixed(1)}%</div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-top: 5px;">Brightness Accuracy</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-family: 'Orbitron', sans-serif; color: var(--nebula-purple);">${practiceObservations.length}</div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-top: 5px;">Meteors Attempted</div>
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 3px solid ${color};">
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-bottom: 10px;">
                    <strong>Individual Meteor Results:</strong>
                </div>
                <div style="display: grid; gap: 6px; max-height: 200px; overflow-y: auto;">
                    ${practiceObservations.map((obs, idx) => {
                        const obsColor = obs.overallAccuracy >= 75 ? '#00ff88' : obs.overallAccuracy >= 60 ? '#ffd700' : obs.overallAccuracy >= 40 ? '#4da8ff' : '#ff6ec7';
                        return `
                            <div style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 5px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">Meteor ${idx + 1}</span>
                                    <span style="color: ${obsColor}; font-size: 0.85rem; font-weight: bold;">${obs.overallAccuracy.toFixed(1)}%</span>
                                </div>
                                <div style="display: flex; gap: 10px; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                                    <span>Dur: ${obs.durationAccuracy.toFixed(0)}%</span>
                                    <span>Bright: ${obs.intensityAccuracy.toFixed(0)}%</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        practiceStatsCard.style.display = 'block';
    }

    createCharts() {
        // First ensure the charts container has the proper structure
        this.ensureChartsStructure();
        
        // Destroy old charts using Chart.js registry
        const existingTimeline = Chart.getChart('timeline-chart');
        const existingBrightness = Chart.getChart('brightness-chart');
        const existingDuration = Chart.getChart('duration-chart');
        
        if (existingTimeline) existingTimeline.destroy();
        if (existingBrightness) existingBrightness.destroy();
        if (existingDuration) existingDuration.destroy();
        
        // Timeline chart
        this.createTimelineChart();
        
        // Brightness distribution chart
        this.createBrightnessChart();
        
        // Duration analysis chart
        this.createDurationChart();
    }
    
    ensureChartsStructure() {
        const chartsContainer = document.querySelector('.charts-container');

        // Check if we need to restore the structure (e.g., after showing "no observations" message)
        if (!chartsContainer.querySelector('#timeline-chart')) {
            chartsContainer.innerHTML = `
                <div class="chart-card" id="session-summary-card" style="display: none;">
                    <h3><i class="bi bi-graph-up"></i> Session Summary</h3>
                    <div id="session-summary-content"></div>
                </div>
                <div class="chart-card">
                    <h3>Meteor Timeline</h3>
                    <canvas id="timeline-chart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Brightness Distribution</h3>
                    <canvas id="brightness-chart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>Duration Analysis</h3>
                    <canvas id="duration-chart"></canvas>
                </div>
            `;
        }
    }

    createTimelineChart() {
        const ctx = document.getElementById('timeline-chart').getContext('2d');

        // Group by 5-minute intervals
        const intervals = {};
        this.observations.forEach(obs => {
            const time = new Date(obs.timestamp);
            const minute = time.getMinutes();
            const interval = Math.floor(minute / 5) * 5;
            const key = `${String(time.getHours()).padStart(2, '0')}:${String(interval).padStart(2, '0')}`;
            intervals[key] = (intervals[key] || 0) + 1;
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(intervals),
                datasets: [{
                    label: 'Meteors Observed',
                    data: Object.values(intervals),
                    borderColor: '#4da8ff',
                    backgroundColor: 'rgba(77, 168, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#4da8ff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: window.innerWidth <= 768 ? 1.2 : 2,
                //aspectRatio: window.innerWidth <= 768 ? ( window.innerWidth <= 500 ? 0.8 : 1.2) : 2,
                animation: {
                    duration: 0 // Disable animation for faster rendering
                },
                plugins: {
                    legend: {
                        display: false,
                        labels: {
                            color: '#fff',
                            font: { size: 12 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Meteors per 5-minute interval',
                        color: '#4da8ff',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Meteors',
                            color: '#fff',
                            font: { size: 12 }
                        },
                        ticks: {
                            color: '#fff',
                            stepSize: 1,
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.1)',
                            drawBorder: true,
                            borderColor: 'rgba(255,255,255,0.3)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#fff',
                            font: { size: 12 }
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.1)',
                            drawBorder: true,
                            borderColor: 'rgba(255,255,255,0.3)'
                        }
                    }
                }
            },
            plugins: [{
                id: 'customCanvasBackgroundColor',
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext('2d');
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        });
    }

    createBrightnessChart() {
        const ctx = document.getElementById('brightness-chart').getContext('2d');

        // Create bins for intensity
        const bins = { 'Faint (0-25)': 0, 'Dim (26-50)': 0, 'Bright (51-75)': 0, 'Very Bright (76-100)': 0 };
        this.observations.forEach(obs => {
            if (obs.intensity <= 25) bins['Faint (0-25)']++;
            else if (obs.intensity <= 50) bins['Dim (26-50)']++;
            else if (obs.intensity <= 75) bins['Bright (51-75)']++;
            else bins['Very Bright (76-100)']++;
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(bins),
                datasets: [{
                    label: 'Number of Meteors',
                    data: Object.values(bins),
                    backgroundColor: ['#4da8ff', '#9d7ff5', '#ff6ec7', '#ffd700'],
                    borderColor: ['#4da8ff', '#9d7ff5', '#ff6ec7', '#ffd700'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: window.innerWidth <= 768 ? 1.2 : 1.8,
                animation: {
                    duration: 0 // Disable animation for faster rendering
                },
                plugins: {
                    legend: {
                        display: false,
                        labels: {
                            color: '#fff',
                            font: { size: 12 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Meteor Brightness Categories',
                        color: '#9d7ff5',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count',
                            color: '#fff',
                            font: { size: 12 }
                        },
                        ticks: {
                            color: '#fff',
                            stepSize: 1,
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.1)',
                            drawBorder: true,
                            borderColor: 'rgba(255,255,255,0.3)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Brightness Category',
                            color: '#fff',
                            font: { size: 12 }
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: {
                            display: false,
                            drawBorder: true,
                            borderColor: 'rgba(255,255,255,0.3)'
                        }
                    }
                }
            },
            plugins: [{
                id: 'customCanvasBackgroundColor',
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext('2d');
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        });
    }

    createDurationChart() {
        const ctx = document.getElementById('duration-chart').getContext('2d');

        // Define bin ranges once
        const binDefinitions = [
          { label: '< 0.4s', min: 0, max: 0.4 },
          { label: '< 0.8s', min: 0.4, max: 0.8 },
          { label: '< 1.2s', min: 0.8, max: 1.2 },
          { label: '< 1.6s', min: 1.2, max: 1.6 },
          { label: '>= 1.6s', min: 1.6, max: Infinity }
        ];
        
        // Initialize bins
        const bins = Object.fromEntries(binDefinitions.map(def => [def.label, 0]));
        
        // Count observations into bins
        this.observations.forEach(obs => {
          const seconds = obs.duration / 1000;
          const bin = binDefinitions.find(def => seconds >= def.min && seconds < def.max);
          if (bin) bins[bin.label]++;
        });

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(bins),
                datasets: [{
                    label: 'Number of Meteors',
                    data: Object.values(bins),
                    backgroundColor: ['#4da8ff', '#9d7ff5', '#ff6ec7', '#ffd700', '#00ff88'],
                    borderColor: ['#4da8ff', '#9d7ff5', '#ff6ec7', '#ffd700', '#00ff88'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: window.innerWidth <= 768 ? 1.2 : 1.4,
                animation: {
                    duration: 0 // Disable animation for faster rendering
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff',
                            font: { size: 12 },
                            padding: 15
                        }
                    },
                    title: {
                        display: true,
                        text: 'Meteor Duration Distribution',
                        color: '#ffd700',
                        font: { size: 14, weight: 'bold' },
                        padding: { bottom: 20 }
                    }
                }
            },
            plugins: [{
                id: 'customCanvasBackgroundColor',
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext('2d');
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        });
    }

    exportData() {
        const data = {
            session: {
                id: this.currentSession,
                startTime: this.sessionStartTime.toISOString(),
                endTime: new Date().toISOString(),
                location: this.location
            },
            observations: this.observations
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meteor-observations-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async downloadReport() {
        try {
            const btn = document.getElementById('download-report-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split btn-icon"></i> Generating...';
            
            console.log('Generating PDF report...');
            
            // Get session data
            const session = await this.db.getSession(this.currentSession);
            const startDate = new Date(session.startTime);
            const endDate = session.endTime ? new Date(session.endTime) : new Date();
            const duration = (endDate - startDate) / 1000 / 60 / 60; // hours
            const mph = this.observations.length > 0 ? (this.observations.length / duration).toFixed(1) : '0.0';
            
            const avgDuration = this.observations.length > 0 
                ? this.observations.reduce((sum, obs) => sum + obs.duration, 0) / this.observations.length / 1000
                : 0;
            const avgIntensity = this.observations.length > 0
                ? this.observations.reduce((sum, obs) => sum + obs.intensity, 0) / this.observations.length
                : 0;
            
            // Initialize jsPDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Function to add starry background to current page
            const addStarryBackground = () => {
                // Black background
                pdf.setFillColor(10, 14, 39);
                pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                
                // Add stars
                const starCount = 150;
                for (let i = 0; i < starCount; i++) {
                    const x = Math.random() * pageWidth;
                    const y = Math.random() * pageHeight;
                    const size = Math.random() * 0.5 + 0.1;
                    const opacity = Math.random() * 0.7 + 0.3;
                    
                    pdf.setFillColor(255, 255, 255);
                    pdf.setGState(new pdf.GState({ opacity: opacity }));
                    pdf.circle(x, y, size, 'F');
                }
                pdf.setGState(new pdf.GState({ opacity: 1 })); // Reset opacity
            };
            
            // First page - starry background
            addStarryBackground();
            
            // Header with gradient effect
            pdf.setFillColor(77, 168, 255, 0.2);
            pdf.roundedRect(10, 10, pageWidth - 20, 35, 5, 5, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(24);
            pdf.setFont(undefined, 'bold');
            pdf.text('METEOR OBSERVATION REPORT', pageWidth / 2, 25, { align: 'center' });
            
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(77, 168, 255);
            pdf.text(startDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }), pageWidth / 2, 35, { align: 'center' });
            
            // Session Info
            pdf.setTextColor(220, 220, 220);
            pdf.setFontSize(10);
            let yPos = 55;
            
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(77, 168, 255);
            pdf.text('Session Details', 15, yPos);
            yPos += 7;
            
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(200, 200, 200);
            pdf.text(`Time: ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`, 15, yPos);
            yPos += 5;
            pdf.text(`Duration: ${Math.round(duration * 60)} minutes`, 15, yPos);
            yPos += 5;
            
            if (session.location) {
                pdf.text(`Location: ${session.location.latitude.toFixed(4)}°, ${session.location.longitude.toFixed(4)}°`, 15, yPos);
                yPos += 5;
            }

            // Add session notes if they exist
            if (session.notes && session.notes.trim()) {
                pdf.text(`Notes: ${session.notes}`, 15, yPos, { maxWidth: pageWidth - 30 });
                // Calculate how many lines the notes took (approximate)
                const lines = Math.ceil(session.notes.length / 80); // rough estimate
                yPos += 5 * lines;
            }

            yPos += 5;
            
            // Statistics boxes
            const boxWidth = (pageWidth - 40) / 4;
            const boxHeight = 25;
            const boxY = yPos;
            
            // Draw stat boxes
            const stats = [
                { label: 'Total Meteors', value: this.observations.length, color: [77, 168, 255] },
                { label: 'Per Hour', value: mph, color: [157, 127, 245] },
                { label: 'Avg Duration', value: avgDuration.toFixed(1) + 's', color: [255, 215, 0] },
                { label: 'Avg Intensity', value: avgIntensity.toFixed(0), color: [0, 255, 136] }
            ];
            
            stats.forEach((stat, i) => {
                const x = 15 + (i * (boxWidth + 2));
                
                // Box background
                pdf.setFillColor(stat.color[0], stat.color[1], stat.color[2], 0.15);
                pdf.roundedRect(x, boxY, boxWidth, boxHeight, 3, 3, 'F');
                
                // Border
                pdf.setDrawColor(stat.color[0], stat.color[1], stat.color[2]);
                pdf.setLineWidth(0.5);
                pdf.roundedRect(x, boxY, boxWidth, boxHeight, 3, 3, 'S');
                
                // Value
                pdf.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
                pdf.setFontSize(16);
                pdf.setFont(undefined, 'bold');
                pdf.text(String(stat.value), x + boxWidth / 2, boxY + 12, { align: 'center' });
                
                // Label
                pdf.setTextColor(200, 200, 200);
                pdf.setFontSize(8);
                pdf.setFont(undefined, 'normal');
                pdf.text(stat.label, x + boxWidth / 2, boxY + 19, { align: 'center' });
            });
            
            yPos = boxY + boxHeight + 15;

            // Only add charts if there are observations
            if (this.observations.length > 0) {
                // Wait for charts to fully render
                await new Promise(resolve => setTimeout(resolve, 500));

                // Capture charts as images
                const charts = [
                    { id: 'timeline-chart', title: 'Meteor Timeline' },
                    { id: 'brightness-chart', title: 'Brightness Distribution' },
                    { id: 'duration-chart', title: 'Duration Analysis' }
                ];

                // Add first chart on the first page (below session stats)
                const firstChart = charts[0];
                const firstChartInstance = Chart.getChart(firstChart.id);

                if (firstChartInstance) {
                    // Force chart to finish rendering
                    firstChartInstance.update();
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Chart title
                    pdf.setTextColor(77, 168, 255);
                    pdf.setFontSize(14);
                    pdf.setFont(undefined, 'bold');
                    pdf.text(firstChart.title, pageWidth / 2, yPos, { align: 'center' });
                    yPos += 10;

                    // Get canvas and convert to image
                    const canvas = firstChartInstance.canvas;
                    const imgData = canvas.toDataURL('image/png', 1.0);
                    const imgWidth = pageWidth - 30;
                    const imgHeight = (canvas.height / canvas.width) * imgWidth;

                    // Add white background behind chart
                    pdf.setFillColor(255, 255, 255);
                    pdf.roundedRect(15, yPos, imgWidth, imgHeight, 3, 3, 'F');

                    // Add chart image
                    pdf.addImage(imgData, 'PNG', 15, yPos, imgWidth, imgHeight);
                }

                // Process remaining charts in pairs (2 per page)
                for (let i = 1; i < charts.length; i += 2) {
                    // Add new page for each pair of charts
                    pdf.addPage();
                    addStarryBackground();
                    yPos = 20;

                    // First chart of the pair
                    const chart1 = charts[i];
                    const chartInstance1 = Chart.getChart(chart1.id);

                    if (chartInstance1) {
                        // Force chart to finish rendering
                        chartInstance1.update();
                        await new Promise(resolve => setTimeout(resolve, 200));

                        // Chart title
                        pdf.setTextColor(77, 168, 255);
                        pdf.setFontSize(14);
                        pdf.setFont(undefined, 'bold');
                        pdf.text(chart1.title, pageWidth / 2, yPos, { align: 'center' });
                        yPos += 10;

                        // Get canvas and convert to image
                        const canvas1 = chartInstance1.canvas;
                        const imgData1 = canvas1.toDataURL('image/png', 1.0);
                        const imgWidth1 = pageWidth - 30;
                        const imgHeight1 = (canvas1.height / canvas1.width) * imgWidth1;

                        // Add white background behind chart
                        pdf.setFillColor(255, 255, 255);
                        pdf.roundedRect(15, yPos, imgWidth1, imgHeight1, 3, 3, 'F');

                        // Add chart image
                        pdf.addImage(imgData1, 'PNG', 15, yPos, imgWidth1, imgHeight1);
                        yPos += imgHeight1 + 15; // Add spacing between charts
                    }

                    // Second chart of the pair (if it exists)
                    if (i + 1 < charts.length) {
                        const chart2 = charts[i + 1];
                        const chartInstance2 = Chart.getChart(chart2.id);

                        if (chartInstance2) {
                            // Force chart to finish rendering
                            chartInstance2.update();
                            await new Promise(resolve => setTimeout(resolve, 200));

                            // Chart title
                            pdf.setTextColor(77, 168, 255);
                            pdf.setFontSize(14);
                            pdf.setFont(undefined, 'bold');
                            pdf.text(chart2.title, pageWidth / 2, yPos, { align: 'center' });
                            yPos += 10;

                            // Get canvas and convert to image
                            const canvas2 = chartInstance2.canvas;
                            const imgData2 = canvas2.toDataURL('image/png', 1.0);
                            const imgWidth2 = pageWidth - 30;
                            const imgHeight2 = (canvas2.height / canvas2.width) * imgWidth2;

                            // Add white background behind chart
                            pdf.setFillColor(255, 255, 255);
                            pdf.roundedRect(15, yPos, imgWidth2, imgHeight2, 3, 3, 'F');

                            // Add chart image
                            pdf.addImage(imgData2, 'PNG', 15, yPos, imgWidth2, imgHeight2);
                            yPos += imgHeight2;
                        }
                    }
                }
            }
            
            // Footer on last page
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(8);
            pdf.text('Generated by Meteor Observer v1.0.202512202201', pageWidth / 2, pageHeight - 10, { align: 'center' });
            pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
            
            // Save PDF
            const filename = `meteor-report-${startDate.toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            console.log('PDF report generated successfully');
            
            // Reset button
            btn.disabled = false;
            btn.innerHTML = originalText;
            
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating PDF report: ' + error.message);
            
            // Reset button
            const btn = document.getElementById('download-report-btn');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-file-earmark-text-fill btn-icon"></i> Download Report';
        }
    }

    newSession() {
        // Reset state
        this.currentSession = null;
        this.sessionStartTime = null;
        this.observations = [];
        this.viewingPastSession = false;
        
        // Clean up any leftover state
        this.cleanupObservingSession();
        
        this.showScreen('ready-screen');
    }
    
    async showPastSessions() {
        try {
            console.log('Loading past sessions');
            const sessions = await this.db.getAllSessions();
            console.log('Found sessions:', sessions.length);
            
            // Sort by start time, most recent first
            sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            
            const sessionsList = document.getElementById('sessions-list');
            
            if (sessions.length === 0) {
                sessionsList.innerHTML = `
                    <div class="empty-sessions">
                        <div class="empty-sessions-icon"><i class="bi bi-stars"></i></div>
                        <p style="font-size: 1.2rem; margin-bottom: 10px;">No observations yet</p>
                        <p style="font-size: 0.9rem;">Start your first meteor observation session!</p>
                    </div>
                `;
            } else {
                sessionsList.innerHTML = sessions.map(session => {
                    const startDate = new Date(session.startTime);
                    const endDate = session.endTime ? new Date(session.endTime) : null;
                    const duration = endDate ? (endDate - startDate) / 1000 / 60 : 0; // minutes
                    const meteors = session.totalObservations || 0;
                    const mph = duration > 0 ? (meteors / (duration / 60)).toFixed(1) : '0.0';
                    
                    return `
                        <div class="session-card" data-session-id="${session.id}">
                            <div class="session-date">${startDate.toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                            })}</div>
                            <div class="session-time">
                                ${startDate.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}
                                ${endDate ? ` - ${endDate.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}` : ''}
                            </div>
                            ${session.location ? `
                                <div class="session-location">
                                    <i class="bi bi-geo-alt-fill"></i> ${session.location.latitude.toFixed(2)}°, ${session.location.longitude.toFixed(2)}°
                                </div>
                            ` : ''}
                            <div class="session-stats">
                                <div class="session-stat">
                                    <div class="session-stat-value">${meteors}</div>
                                    <div class="session-stat-label">Meteors</div>
                                </div>
                                <div class="session-stat">
                                    <div class="session-stat-value">${mph}</div>
                                    <div class="session-stat-label">Per Hour</div>
                                </div>
                                <div class="session-stat">
                                    <div class="session-stat-value">${Math.round(duration)}</div>
                                    <div class="session-stat-label">Minutes</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Add click handlers to session cards
                sessionsList.querySelectorAll('.session-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const sessionId = parseInt(card.dataset.sessionId);
                        this.loadSession(sessionId);
                    });
                });
            }
            
            this.showScreen('past-sessions-screen');
        } catch (error) {
            console.error('Error loading past sessions:', error);
            alert('Error loading past sessions: ' + error.message);
        }
    }
    
    async loadSession(sessionId) {
        try {
            console.log('Loading session:', sessionId);

            // Load session data
            const session = await this.db.getSession(sessionId);
            if (!session) {
                alert('Session not found');
                return;
            }

            // Load observations for this session
            this.observations = await this.db.getObservationsBySession(sessionId);
            console.log('Loaded observations:', this.observations.length);

            // Set current session for display
            this.currentSession = sessionId;
            this.sessionStartTime = new Date(session.startTime);
            this.viewingPastSession = true; // Mark as viewing historical data

            // Show results for this session
            await this.showResults();
        } catch (error) {
            console.error('Error loading session:', error);
            alert('Error loading session: ' + error.message);
        }
    }

    async saveSessionNotes() {
        try {
            const notesTextarea = document.getElementById('session-notes');
            const notes = notesTextarea.value.trim();

            console.log('Saving notes for session:', this.currentSession);

            // Update session with notes
            await this.db.updateSession(this.currentSession, { notes: notes });

            // Update sync status since we modified data
            await this.updateSyncStatus();

            // Show feedback
            const btn = document.getElementById('save-notes-btn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-circle-fill btn-icon"></i> Saved!';
            btn.style.background = 'var(--success-green)';

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
            }, 2000);

            console.log('Notes saved successfully');
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Error saving notes: ' + error.message);
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const activeScreen = document.getElementById(screenId);
        activeScreen.classList.add('active');

        // Reset scroll position to top
        window.scrollTo(0, 0);
        activeScreen.scrollTop = 0;
    }

    // ==================== Practice Mode Methods ====================

    scheduleNextPracticeMeteor() {
        if (!this.practiceMode || this.waitingForNextMeteor) return;

        this.waitingForNextMeteor = true;

        // Wait for feedback to fade (3s) + random delay (1-3s)
        const delay = 3000 + 1000 + Math.random() * 2000;

        setTimeout(() => {
            this.waitingForNextMeteor = false;
            if (this.practiceMode) {
                this.generatePracticeMeteor();
            }
        }, delay);
    }

    generatePracticeMeteor() {
        if (!this.practiceMode || !this.canvas) return;

        // Clear previous meteor data now that we're generating a new one
        this.currentPracticeMeteor = null;

        // Random starting position (from edges)
        const startSide = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
        let startX, startY, endX, endY;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // Define start and end points based on side
        // Meteors come from edges and travel diagonally across screen
        switch (startSide) {
            case 0: // top -> bottom
                startX = Math.random() * canvasWidth;
                startY = 0;
                // End somewhere on bottom half, offset from start
                endX = Math.random() * canvasWidth;
                endY = canvasHeight * (0.7 + Math.random() * 0.3); // 70-100% down
                break;
            case 1: // right -> left
                startX = canvasWidth;
                startY = Math.random() * canvasHeight;
                // End somewhere on left half
                endX = canvasWidth * (Math.random() * 0.3); // 0-30% from left
                endY = Math.random() * canvasHeight;
                break;
            case 2: // bottom -> top
                startX = Math.random() * canvasWidth;
                startY = canvasHeight;
                // End somewhere on top half
                endX = Math.random() * canvasWidth;
                endY = canvasHeight * (Math.random() * 0.3); // 0-30% from top
                break;
            case 3: // left -> right
                startX = 0;
                startY = Math.random() * canvasHeight;
                // End somewhere on right half
                endX = canvasWidth * (0.7 + Math.random() * 0.3); // 70-100% from left
                endY = Math.random() * canvasHeight;
                break;
        }

        // Random properties
        const duration = 0.5 + Math.random() * 2; // 0.5 to 2.5 seconds
        const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const intensity = Math.floor(20 + Math.random() * 80); // 20-100 intensity

        console.log(`Start: (${startX}, ${startY}), End: (${endX}, ${endY}), Distance: ${distance}`);

        // Brightness affects visual size and glow
        const brightness = intensity / 100;
        const size = 3 + brightness * 7; // 3-10px

        // Store current meteor data for scoring
        this.currentPracticeMeteor = {
            duration: duration * 1000, // convert to ms
            intensity: intensity,
            distance: distance,
            startTime: Date.now()
        };

        // Create meteor element
        const meteor = document.createElement('div');
        meteor.className = 'practice-meteor';
        meteor.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, rgba(255, 215, 0, ${brightness}), rgba(77, 168, 255, ${brightness * 0.6}));
            border-radius: 50%;
            box-shadow: 0 0 ${size * 3}px rgba(255, 215, 0, ${brightness * 0.8});
            pointer-events: none;
            z-index: 100;
            --meteor-dx: ${endX - startX}px;
            --meteor-dy: ${endY - startY}px;
            animation: meteor-fly ${duration}s linear forwards;
        `;

        // Add trail effect
        const trail = document.createElement('div');
        trail.style.cssText = `
            position: absolute;
            width: ${size * 3}px;
            height: ${size / 2}px;
            background: linear-gradient(to right, rgba(255, 215, 0, ${brightness * 0.6}), transparent);
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            filter: blur(2px);
        `;
        meteor.appendChild(trail);

        // Add to touch area
        const touchArea = document.getElementById('touch-area');
        touchArea.appendChild(meteor);

        // Remove meteor element after animation
        setTimeout(() => {
            if (meteor.parentNode) {
                meteor.parentNode.removeChild(meteor);
            }
        }, duration * 1000 + 100);

        console.log(`Practice meteor: duration=${duration.toFixed(2)}s, intensity=${intensity}, distance=${distance.toFixed(0)}px`);
    }

    calculatePracticeScore(recordedDuration, recordedIntensity) {
        if (!this.currentPracticeMeteor) {
            console.log('calculatePracticeScore: No current meteor');
            return null;
        }

        const actual = this.currentPracticeMeteor;
        console.log(`Calculating score - Recorded: ${recordedDuration}ms/${recordedIntensity}, Actual: ${actual.duration}ms/${actual.intensity}`);

        // Calculate accuracy percentages
        const durationAccuracy = 100 - Math.min(100, Math.abs(recordedDuration - actual.duration) / actual.duration * 100);
        const intensityAccuracy = 100 - Math.abs(recordedIntensity - actual.intensity);

        // Overall accuracy (average of both)
        const overallAccuracy = (durationAccuracy + intensityAccuracy) / 2;

        // Update score
        this.practiceScore.total++;
        this.practiceScore.accuracySum += overallAccuracy;

        const avgAccuracy = this.practiceScore.accuracySum / this.practiceScore.total;

        console.log(`Accuracies - Duration: ${durationAccuracy.toFixed(1)}%, Intensity: ${intensityAccuracy.toFixed(1)}%, Overall: ${overallAccuracy.toFixed(1)}%`);

        // Show feedback
        const feedback = this.createScoreFeedback(overallAccuracy, durationAccuracy, intensityAccuracy, avgAccuracy);
        console.log('Showing feedback:', feedback);
        this.showPracticeScoreFeedback(feedback);

        // Return practice data for storage
        return {
            actualDuration: actual.duration,
            actualIntensity: actual.intensity,
            durationAccuracy: durationAccuracy,
            intensityAccuracy: intensityAccuracy,
            overallAccuracy: overallAccuracy
        };
    }

    createScoreFeedback(overallAccuracy, durationAccuracy, intensityAccuracy, avgAccuracy) {
        let grade, color;

        if (overallAccuracy >= 90) {
            grade = 'Excellent!';
            color = '#00ff88';
        } else if (overallAccuracy >= 75) {
            grade = 'Great!';
            color = '#ffd700';
        } else if (overallAccuracy >= 60) {
            grade = 'Good';
            color = '#4da8ff';
        } else if (overallAccuracy >= 40) {
            grade = 'Fair';
            color = '#ff6ec7';
        } else {
            grade = 'Keep Trying';
            color = '#ff4757';
        }

        return {
            grade,
            color,
            overallAccuracy: overallAccuracy.toFixed(1),
            durationAccuracy: durationAccuracy.toFixed(1),
            intensityAccuracy: intensityAccuracy.toFixed(1),
            avgAccuracy: avgAccuracy.toFixed(1),
            total: this.practiceScore.total
        };
    }

    showPracticeScoreFeedback(feedback) {
        // Create feedback overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '20px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.background = 'rgba(0, 0, 0, 0.9)';
        overlay.style.border = `2px solid ${feedback.color}`;
        overlay.style.borderRadius = '15px';
        overlay.style.padding = '15px 25px';
        overlay.style.zIndex = '100';
        overlay.style.minWidth = '250px';
        overlay.style.textAlign = 'center';
        overlay.style.fontFamily = "'Orbitron', sans-serif";
        overlay.style.animation = 'fadeIn 0.3s ease-out';
        overlay.style.pointerEvents = 'none';

        overlay.innerHTML = `
            <div style="font-size: 1.5rem; color: ${feedback.color}; font-weight: 700; margin-bottom: 10px;">
                ${feedback.grade}
            </div>
            <div style="font-size: 0.9rem; color: rgba(255,255,255,0.8); margin-bottom: 8px;">
                Overall: ${feedback.overallAccuracy}%
            </div>
            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); display: flex; justify-content: space-around;">
                <span>Duration: ${feedback.durationAccuracy}%</span>
                <span>Brightness: ${feedback.intensityAccuracy}%</span>
            </div>
            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                Session Average: ${feedback.avgAccuracy}% (${feedback.total} meteors)
            </div>
        `;

        const touchArea = document.getElementById('touch-area');
        touchArea.appendChild(overlay);

        // Remove after 3 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s ease-out';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 500);
            }
        }, 3000);
    }

    // ==================== Sync-related methods

    async updateSyncStatus() {
        try {
            const status = await this.syncService.getSyncStatus();
            const syncStatusEl = document.getElementById('sync-status');
            const syncIconEl = document.getElementById('sync-icon');
            const syncStatusTextEl = document.getElementById('sync-status-text');
            const syncDetailsEl = document.getElementById('sync-details');
            const syncNowBtn = document.getElementById('sync-now-btn');

            if (status.hasUnsyncedData) {
                syncStatusEl.style.display = 'block';
                syncIconEl.className = 'bi bi-cloud-slash';
                syncStatusTextEl.textContent = 'Unsynced data available';
                syncDetailsEl.textContent = `${status.totalUnsynced} session(s) need syncing`;
                syncNowBtn.style.display = 'block';
            } else {
                syncStatusEl.style.display = 'block';
                syncIconEl.className = 'bi bi-cloud-check';
                syncStatusTextEl.textContent = 'All data synced';
                syncDetailsEl.textContent = 'Your observations are backed up';
                syncNowBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to update sync status:', error);
            // Hide sync status on error (might not have backend configured)
            document.getElementById('sync-status').style.display = 'none';
        }
    }

    async showSyncSettings() {
        // Load saved privacy preference
        const savedPrivacy = localStorage.getItem('location-privacy') || 'full';
        document.querySelector(`input[name="location-privacy"][value="${savedPrivacy}"]`).checked = true;

        // Update auth status display
        this.updateAuthStatusDisplay();

        // Display device ID
        document.getElementById('device-id-display').textContent = this.syncService.deviceId;

        // Update unsynced count
        try {
            const status = await this.syncService.getSyncStatus();
            const unsyncedCountEl = document.getElementById('unsynced-count');

            if (status.hasUnsyncedData) {
                unsyncedCountEl.innerHTML = `
                    <strong>${status.totalUnsynced}</strong> session(s) need syncing<br>
                    <span style="font-size: 0.85rem; color: rgba(255,255,255,0.5);">
                        ${status.sessions.unsynced || 0} new, ${status.sessions.modified || 0} modified
                    </span>
                `;
            } else {
                unsyncedCountEl.innerHTML = '<span style="color: var(--success-green);">All data is synced!</span>';
            }
        } catch (error) {
            console.error('Failed to get sync status:', error);
            document.getElementById('unsynced-count').innerHTML = '<span style="color: var(--error-red);">Unable to check sync status</span>';
        }

        this.showScreen('sync-settings-screen');
    }

    async syncAllData() {
        const btn = event.target;
        const originalHTML = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split btn-icon"></i> Syncing...';

            const locationPrivacy = document.querySelector('input[name="location-privacy"]:checked')?.value || 'full';
            const results = await this.syncService.syncToRemote(locationPrivacy);

            console.log('Sync results:', results);

            // If authenticated, migrate any newly-synced anonymous sessions
            if (this.authService.isAuthenticated() && results.synced > 0) {
                console.log('Running post-sync migration...');
                const deviceId = this.syncService ? this.syncService.deviceId : null;
                if (deviceId) {
                    await this.authService.migrateDeviceSessions(deviceId);
                }
            }

            // Update UI
            await this.updateSyncStatus();

            if (results.failed === 0) {
                btn.innerHTML = '<i class="bi bi-check-circle btn-icon"></i> Synced!';
                btn.style.background = 'var(--success-green)';

                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 2000);

                // Refresh sync settings if on that screen
                if (document.getElementById('sync-settings-screen').classList.contains('active')) {
                    setTimeout(() => this.showSyncSettings(), 2100);
                }
            } else {
                throw new Error(`${results.failed} session(s) failed to sync`);
            }

        } catch (error) {
            console.error('Sync failed:', error);
            alert(`Sync failed: ${error.message}\n\nPlease check your internet connection and try again.`);

            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    // ==================== Authentication Methods ====================

    async verifyAuthToken() {
        if (this.authService.isAuthenticated()) {
            const result = await this.authService.verify();
            if (!result.valid) {
                console.log('Auth token expired or invalid, logging out');
            } else {
                console.log('Auth token verified, user:', result.user.email);
            }
        }
    }

    updateAuthStatusDisplay() {
        const isAuth = this.authService.isAuthenticated();
        const statusText = document.getElementById('auth-status-text');
        const userEmail = document.getElementById('auth-user-email');
        const userEmailText = document.getElementById('auth-user-email-text');
        const authActionBtn = document.getElementById('auth-action-btn');
        const authActionText = document.getElementById('auth-action-text');

        if (isAuth) {
            const user = this.authService.getCurrentUser();
            statusText.style.display = 'none';
            userEmail.style.display = 'block';
            userEmailText.textContent = user.email;
            authActionBtn.innerHTML = '<i class="bi bi-person-circle btn-icon"></i><span>Manage Account</span>';
        } else {
            statusText.style.display = 'block';
            userEmail.style.display = 'none';
            authActionBtn.innerHTML = '<i class="bi bi-box-arrow-in-right btn-icon"></i><span>Sign In / Sign Up</span>';
        }
    }

    handleAuthAction() {
        if (this.authService.isAuthenticated()) {
            // Go to account screen
            this.showAccountScreen();
        } else {
            // Go to login screen
            this.authMode = 'login';
            this.updateAuthScreen();
            this.showScreen('auth-screen');
        }
    }

    showAccountScreen() {
        const user = this.authService.getCurrentUser();
        if (!user) {
            this.showScreen('sync-settings-screen');
            return;
        }

        document.getElementById('account-email').textContent = user.email;
        document.getElementById('account-created').textContent = new Date(user.createdAt).toLocaleDateString();
        document.getElementById('account-last-login').textContent = user.lastLogin
            ? new Date(user.lastLogin).toLocaleDateString()
            : 'N/A';

        this.showScreen('account-screen');
    }

    toggleAuthMode() {
        this.authMode = this.authMode === 'login' ? 'signup' : 'login';
        this.updateAuthScreen();
    }

    updateAuthScreen() {
        const title = document.getElementById('auth-screen-title');
        const submitText = document.getElementById('auth-submit-text');
        const toggleText = document.getElementById('auth-toggle-text');

        if (this.authMode === 'login') {
            title.textContent = 'Sign In';
            submitText.textContent = 'Sign In';
            toggleText.textContent = "Don't have an account? Sign Up";
        } else {
            title.textContent = 'Create Account';
            submitText.textContent = 'Create Account';
            toggleText.textContent = 'Already have an account? Sign In';
        }

        // Clear error and form
        document.getElementById('auth-error').style.display = 'none';
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
    }

    async handleAuthSubmit() {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        const submitBtn = document.getElementById('auth-submit-btn');

        // Clear previous errors
        errorDiv.style.display = 'none';

        // Validate
        if (!email || !password) {
            errorDiv.textContent = 'Please enter both email and password';
            errorDiv.style.display = 'block';
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split btn-icon"></i> Please wait...';

        try {
            let result;
            // Pass deviceId to automatically migrate anonymous sessions
            const deviceId = this.syncService ? this.syncService.deviceId : null;

            if (this.authMode === 'login') {
                result = await this.authService.login(email, password, deviceId);
            } else {
                result = await this.authService.register(email, password, deviceId);
            }

            if (result.success) {
                console.log('Auth successful:', result.user);

                // Download user's existing sessions from remote to local cache
                try {
                    console.log('Downloading previous sessions from cloud...');
                    const downloadResults = await this.syncService.downloadRemoteSessions();
                    console.log(`Downloaded ${downloadResults.downloaded} session(s), skipped ${downloadResults.skipped} (already local)`);

                    if (downloadResults.downloaded > 0) {
                        // Refresh the session list if user is viewing past sessions
                        if (document.getElementById('past-sessions-screen').style.display !== 'none') {
                            await this.showPastSessions();
                        }
                    }
                } catch (error) {
                    console.error('Error downloading sessions:', error);
                    // Don't fail the login if download fails - just log it
                }

                // Go back to sync settings
                this.showScreen('sync-settings-screen');
                this.updateAuthStatusDisplay();

                // Update sync status to reflect new auth state
                await this.updateSyncStatus();
            } else {
                errorDiv.textContent = result.error || 'Authentication failed';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHTML;
            }
        } catch (error) {
            console.error('Auth error:', error);
            errorDiv.textContent = 'An error occurred. Please try again.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to sign out?')) {
            this.authService.logout();
            this.showScreen('sync-settings-screen');
            this.updateAuthStatusDisplay();
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new MeteorObserver();
    });
} else {
    window.app = new MeteorObserver();
}
