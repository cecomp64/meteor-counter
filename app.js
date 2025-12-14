// Main application logic
class MeteorObserver {
    constructor() {
        this.db = new MeteorDB();
        this.currentSession = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.location = null;
        this.observations = [];
        this.viewingPastSession = false; // Track if viewing historical data
        
        // Touch tracking
        this.touchStart = null;
        this.touchStartPos = null;
        this.touchMovement = 0;
        this.isRecording = false;
        
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
        this.setupEventListeners();
        this.registerServiceWorker();
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
            this.startObserving();
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
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('new-session-btn').addEventListener('click', () => {
            this.newSession();
        });
        
        document.getElementById('back-to-sessions-btn').addEventListener('click', () => {
            this.showPastSessions();
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
        btn.innerHTML = '<span class="btn-icon">⏳</span> Getting Location...';

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
            btn.innerHTML = '<span class="btn-icon">📍</span> Enable Location';
        }
    }

    async startObserving() {
        // Clean up any previous session state
        this.cleanupObservingSession();
        
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
        
        // Create session in database
        const session = {
            startTime: this.sessionStartTime.toISOString(),
            location: this.location,
            observations: []
        };
        
        this.currentSession = await this.db.saveSession(session);
        
        // Update UI
        document.getElementById('session-start-time').textContent = 
            `Started ${this.sessionStartTime.toLocaleTimeString()}`;
        document.getElementById('meteor-count').textContent = '0';
        document.getElementById('meteors-per-hour').textContent = '0.0';
        
        // Setup canvas
        this.canvas = document.getElementById('visual-feedback');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Setup touch area listeners
        this.setupTouchArea();
        
        // Start timer
        this.startSessionTimer();
        
        // Test sound and vibration to confirm they work
        setTimeout(() => {
            console.log('Playing test sound and vibration');
            this.playSound();
            this.vibrate();
        }, 300);
        
        this.showScreen('observing-screen');
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
        
        // Visual feedback
        this.drawMeteorStart(e.clientX - this.canvas.offsetLeft, e.clientY - this.canvas.offsetTop);
    }

    handleTouchMove(e) {
        if (!this.isRecording) return;
        
        const dx = e.clientX - this.touchStartPos.x;
        const dy = e.clientY - this.touchStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.touchMovement = Math.max(this.touchMovement, distance);
        
        // Visual feedback
        this.drawMeteorTrail(
            e.clientX - this.canvas.offsetLeft,
            e.clientY - this.canvas.offsetTop
        );
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
        
        // Create observation
        const observation = {
            sessionId: this.currentSession,
            timestamp: new Date().toISOString(),
            duration: duration,
            intensity: intensity,
            location: this.location
        };
        
        // Save to database
        console.log('Saving observation:', observation);
        await this.db.saveObservation(observation);
        this.observations.push(observation);
        console.log('Observation saved, total count:', this.observations.length);
        
        // Update UI
        this.updateStats();
        
        // Feedback
        this.playSound();
        this.vibrate();
        this.drawMeteorComplete();
        
        setTimeout(() => this.clearCanvas(), 500);
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
            
            // Clean up the observing session
            this.cleanupObservingSession();
            
            const endTime = new Date();
            const duration = endTime - this.sessionStartTime;
            
            console.log('Updating session:', this.currentSession);
            
            // Update session in database
            await this.db.updateSession(this.currentSession, {
                endTime: endTime.toISOString(),
                duration: duration,
                totalObservations: this.observations.length
            });
            
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
        
        const duration = new Date(session.endTime) - new Date(session.startTime);
        const hours = duration / 1000 / 60 / 60;
        const mph = this.observations.length > 0 ? (this.observations.length / hours).toFixed(1) : '0.0';
        
        const avgDuration = this.observations.length > 0 
            ? this.observations.reduce((sum, obs) => sum + obs.duration, 0) / this.observations.length / 1000
            : 0;
        const avgIntensity = this.observations.length > 0
            ? this.observations.reduce((sum, obs) => sum + obs.intensity, 0) / this.observations.length
            : 0;
        
        document.getElementById('results-summary').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 20px;">
                <div>
                    <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--nebula-blue);">${this.observations.length}</div>
                    <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Total Meteors</div>
                </div>
                <div>
                    <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--nebula-purple);">${mph}</div>
                    <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Per Hour</div>
                </div>
                <div>
                    <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--meteor-gold);">${avgDuration.toFixed(1)}s</div>
                    <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Avg Duration</div>
                </div>
                <div>
                    <div style="font-size: 2rem; font-family: 'Orbitron', sans-serif; color: var(--success-green);">${avgIntensity.toFixed(0)}</div>
                    <div style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">Avg Intensity</div>
                </div>
            </div>
            <div style="font-size: 0.9rem; color: rgba(255,255,255,0.5);">
                Session: ${new Date(session.startTime).toLocaleTimeString()} - ${new Date(session.endTime).toLocaleTimeString()}
            </div>
        `;
        
        // Only create charts if there are observations
        if (this.observations.length > 0) {
            console.log('Creating charts for', this.observations.length, 'observations');
            this.createCharts();
        } else {
            // Show message if no observations
            console.log('No observations, showing empty message');
            document.querySelector('.charts-container').innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
                    <p>No meteors recorded during this session.</p>
                    <p style="margin-top: 10px; font-size: 0.9rem;">Try a longer observation period during peak meteor shower times!</p>
                </div>
            `;
        }
        
        console.log('Showing results screen');
        this.showScreen('results-screen');
        
        // Show/hide "Back to Sessions" button based on context
        const backToSessionsBtn = document.getElementById('back-to-sessions-btn');
        backToSessionsBtn.style.display = this.viewingPastSession ? 'flex' : 'none';
        
        console.log('Results screen shown');
        } catch (error) {
            console.error('Error in showResults:', error);
            alert('Error showing results: ' + error.message);
            this.showScreen('ready-screen');
        }
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
                    label: 'Meteors per 5 minutes',
                    data: Object.values(intervals),
                    borderColor: '#4da8ff',
                    backgroundColor: 'rgba(77, 168, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
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
                    label: 'Count',
                    data: Object.values(bins),
                    backgroundColor: ['#4da8ff', '#9d7ff5', '#ff6ec7', '#ffd700']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#fff' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    createDurationChart() {
        const ctx = document.getElementById('duration-chart').getContext('2d');
        
        // Create bins for duration (in seconds)
        const bins = { '0-1s': 0, '1-2s': 0, '2-3s': 0, '3-5s': 0, '5s+': 0 };
        this.observations.forEach(obs => {
            const seconds = obs.duration / 1000;
            if (seconds <= 1) bins['0-1s']++;
            else if (seconds <= 2) bins['1-2s']++;
            else if (seconds <= 3) bins['2-3s']++;
            else if (seconds <= 5) bins['3-5s']++;
            else bins['5s+']++;
        });
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(bins),
                datasets: [{
                    data: Object.values(bins),
                    backgroundColor: ['#4da8ff', '#9d7ff5', '#ff6ec7', '#ffd700', '#00ff88']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#fff' }
                    }
                }
            }
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
                        <div class="empty-sessions-icon">🌌</div>
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
                                    📍 ${session.location.latitude.toFixed(2)}°, ${session.location.longitude.toFixed(2)}°
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

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
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
