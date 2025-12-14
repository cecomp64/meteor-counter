# Meteor Observer 🌠

**Version 1.0.202512141047**

A Progressive Web App (PWA) for tracking meteor shower observations with precision timing, brightness analysis, and offline capability.

## Features

### Core Functionality
- **Press-and-hold observation recording**: Touch/click anywhere to record meteors
- **Duration tracking**: Length of press indicates meteor trail duration
- **Brightness detection**: Movement during press indicates intensity (0-100 scale)
- **Real-time statistics**: Live count and meteors-per-hour calculation
- **Audio & haptic feedback**: Satisfying confirmation on each observation
- **Location tracking**: Optional GPS integration for location-based analysis

### Data & Analysis
- **IndexedDB storage**: All observations saved locally in the browser
- **Session management**: Track multiple observation sessions
- **Past sessions viewer**: Browse and review all your previous observations
- **Interactive charts**: Timeline, brightness distribution, and duration analysis
- **PDF Reports**: Download professional observation reports with charts and statistics
- **Data export**: Download observations as JSON for further analysis

### Offline Capability
- **Service Worker caching**: Works completely offline after first load
- **PWA features**: Installable on mobile devices and desktops
- **No internet required**: Perfect for dark-sky locations

## Usage

### Starting an Observation Session

1. **Grant Location Access** (optional but recommended)
   - Helps calculate local meteor rates
   - Can skip if location isn't needed

2. **Start Observing**
   - Press the "Start Observing" button
   - Timer begins tracking session duration

3. **Record Meteors**
   - Touch/click anywhere on the observation area
   - Hold for the duration of the meteor
   - Move your finger/mouse to indicate brightness
   - Release when the meteor disappears
   - You'll hear a confirmation sound and feel haptic feedback

4. **Monitor Statistics**
   - Real-time count of observed meteors
   - Live meteors-per-hour calculation
   - Session timer

5. **End Session**
   - Press "Stop" to end the observation
   - View comprehensive charts and statistics
   - **Download Report** to get a professional PDF with all charts
   - Export data as JSON if needed

### Understanding the Measurements

- **Duration**: The time you hold the press (in milliseconds)
  - Short press (0-1s): Quick meteor
  - Medium press (1-3s): Average meteor
  - Long press (3s+): Slow-moving or fireball

- **Intensity**: The distance your finger/mouse moves while pressed
  - 0-25: Faint meteor (barely visible)
  - 26-50: Dim meteor (easily visible)
  - 51-75: Bright meteor (catches attention)
  - 76-100: Very bright meteor (fireball)

## Deployment

**Important:** For full functionality on iOS Safari (geolocation, service workers), the app **must be served over HTTPS**. All the hosting options below provide HTTPS automatically.

This app can be hosted on any static hosting platform. Here are the most popular options:

### Option 1: Netlify (Recommended)

1. **Via Drag & Drop**
   - Go to [Netlify Drop](https://app.netlify.com/drop)
   - Drag the entire `meteor-observer` folder onto the page
   - Your app will be live instantly with a random URL
   - Optional: Customize the domain in site settings

2. **Via Git**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Navigate to project directory
   cd meteor-observer
   
   # Deploy
   netlify deploy --prod
   ```

### Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to project directory
cd meteor-observer

# Deploy
vercel --prod
```

### Option 3: GitHub Pages

1. Create a new repository on GitHub
2. Push the meteor-observer folder:
   ```bash
   cd meteor-observer
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/meteor-observer.git
   git push -u origin main
   ```
3. Go to repository Settings > Pages
4. Select "main" branch as source
5. Your app will be live at `https://yourusername.github.io/meteor-observer/`

### Option 4: Cloudflare Pages

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Connect your Git repository OR upload files directly
3. Deploy with default settings
4. App will be live on Cloudflare's global CDN

## File Structure

```
meteor-observer/
├── index.html          # Main HTML structure
├── styles.css          # Cosmic-themed styling with animations
├── app.js              # Core application logic
├── db.js               # IndexedDB wrapper for data storage
├── service-worker.js   # Offline caching and PWA functionality
├── manifest.json       # PWA configuration
└── README.md           # This file
```

## Technical Details

### Browser Compatibility
- **Modern browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari 11.3+, Chrome for Android
- **Features used**: 
  - IndexedDB for storage
  - Service Workers for offline capability
  - Geolocation API for location tracking
  - Web Audio API for sound feedback
  - Vibration API for haptic feedback (mobile)
  - Canvas API for visual effects

### Important Notes for iOS Safari

**Geolocation:**
- Requires **HTTPS** in production (http:// won't work except on localhost)
- Location permissions are in Settings > Safari > Location Services
- You can skip location if permission is denied - the app works fine without it

**Audio:**
- The app automatically initializes audio on first interaction
- Respects the hardware mute switch
- Will play a test sound when you start observing

**Haptic Feedback:**
- Works on iPhone with iOS 13+
- Requires permission in browser settings

### Data Storage
All data is stored locally in the browser using IndexedDB:
- **Observations**: Individual meteor recordings with timestamp, duration, intensity
- **Sessions**: Observation session metadata with start/end times
- **No server required**: Everything runs client-side

### Offline Capability
The app uses a Service Worker to cache all resources:
- First visit requires internet connection
- After caching, works completely offline
- Perfect for remote dark-sky locations
- Updates cache when online

## Privacy

- **Location data**: Only collected if you grant permission
- **No tracking**: No analytics, cookies, or external tracking
- **Local storage only**: All data stays in your browser
- **No accounts**: No sign-up or login required

## Customization

### Updating the Version Number

**Quick Method (Unix/Mac/Linux):**
Run the included script:
```bash
./update-version.sh
```

This automatically updates the version to `1.0.[current-timestamp]` in all necessary files.

**Manual Method:**
When making updates to the app, update the version in these files:
1. **index.html** - Update the version indicator text AND all query parameters (`?v=...`) on:
   - `<link rel="manifest">`
   - `<link rel="stylesheet">`
   - `<script src="db.js">`
   - `<script src="app.js">`
2. **manifest.json** - Update the `version` field
3. **service-worker.js** - Update:
   - `CACHE_NAME` constant
   - All URLs in `urlsToCache` array with new query parameters
4. **README.md** - Update the version at the top

Version format: `1.0.YYYYMMDDHHMM` (timestamp of build)

**Why query parameters?** They force browsers to fetch fresh files instead of using cached versions when you deploy updates.

### Changing Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --cosmic-deep: #0a0e27;      /* Background color */
    --nebula-blue: #4da8ff;      /* Primary accent */
    --nebula-purple: #9d7ff5;    /* Secondary accent */
    --meteor-gold: #ffd700;      /* Meteor color */
}
```

### Modifying Chart Types
Charts use Chart.js. Edit chart configurations in the `createCharts()` methods in `app.js`.

### Adjusting Sensitivity
In `app.js`, modify these values:
```javascript
// Minimum press duration to count (ms)
if (duration < 100) return;  // Change 100 to your preference

// Intensity calculation
const intensity = Math.min(100, Math.round(this.touchMovement / 2));
// Change the divisor (2) to adjust sensitivity
```

## Tips for Best Results

1. **Dark adaptation**: Let your eyes adjust to darkness for 20-30 minutes
2. **Comfortable position**: Use a reclining chair or lying position
3. **Screen brightness**: Lower to minimum to preserve night vision
4. **Practice**: Do a few test recordings to get the hang of it
5. **Time intervals**: 5-minute observation blocks work well
6. **Peak hours**: Most meteor showers peak in pre-dawn hours

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

This is a standalone project, but feel free to fork and customize for your needs!

## Astronomy Resources

- [American Meteor Society](https://www.amsmeteors.org/) - Meteor shower predictions
- [International Meteor Organization](https://www.imo.net/) - Global meteor data
- [Heavens-Above](https://www.heavens-above.com/) - Sky event predictions

---

Clear skies and happy observing! 🌌✨
