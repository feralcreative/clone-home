# BrowserSync Setup for Clone Home

This document explains how to use the BrowserSync submodule with the Clone Home project for live-reload development.

## 🚀 Quick Start

### Option 1: Development Mode (Easiest)

**Single command to start everything:**

```bash
npm run dev
```

This automatically:
- Starts the Clone Home web server (port 3847) without opening a browser
- Starts BrowserSync (port 3001) which opens the browser for you
- Sets up live-reload for all files in the `web/` directory

### Option 2: Manual Setup

**Step 1: Start Your Clone Home Server**
```bash
npm start web
```

**Step 2: Start BrowserSync**

Choose one of these methods:

**Method A: Direct BrowserSync (Recommended)**
```bash
npm run browsersync
```

**Method B: Using Gulp**
```bash
npm run browsersync:gulp
```

**Method C: Manual (from submodule directory)**
```bash
cd libs/browser-sync
npm run start-clone-home
# or
npx gulp serve-clone-home
```

### 3. Development Workflow

1. **BrowserSync will open your browser** automatically to `http://localhost:3001`
2. **Make changes** to files in the `web/` directory
3. **Watch the magic** - your browser will automatically reload when you save files

## 📁 What Files Are Watched?

BrowserSync monitors these file patterns for changes:

- `web/**/*.html` - HTML files
- `web/**/*.css` - CSS files  
- `web/**/*.scss` - SCSS files
- `web/**/*.js` - JavaScript files
- `web/assets/**/*` - All asset files

## 🛠️ Available Commands

### Main Project Commands

```bash
# Development mode (starts both web server and BrowserSync)
npm run dev

# Start BrowserSync with clone-home config
npm run browsersync

# Start BrowserSync using Gulp
npm run browsersync:gulp

# Show BrowserSync help
npm run browsersync:help

# List available configurations
npm run browsersync:configs
```

### Submodule Commands

```bash
cd libs/browser-sync

# Direct BrowserSync commands
npm run start-clone-home    # Start with clone-home config
npm run start-test          # Start with test config

# Gulp commands
npx gulp serve-clone-home   # Start with clone-home config
npx gulp serve-test         # Start with test config
npx gulp help               # Show all available tasks
npx gulp list-configs       # List available configurations
npx gulp stop               # Stop BrowserSync
```

## 🔧 Configuration

The BrowserSync configuration for Clone Home is in `libs/browser-sync/bs-config-clone-home.js`:

```javascript
{
  proxy: { target: "http://localhost:3847" },  // Your Clone Home server
  port: 3001,                                  // BrowserSync port
  files: ["../../web/**/*"],                   // Files to watch
  notify: true,                                // Browser notifications
  open: true,                                  // Auto-open browser
  injectChanges: true,                         // CSS injection without reload
}
```

## 🎯 Ports Used

- **3847** - Clone Home web server (your main app)
- **3001** - BrowserSync proxy server (what you browse to)
- **3002** - BrowserSync UI (admin interface)

## 🔄 Development Workflow Examples

### CSS Development
1. Edit `web/assets/styles/styles.scss`
2. Run `npm run watch-css` (in another terminal)
3. BrowserSync will inject CSS changes without page reload

### JavaScript Development  
1. Edit `web/app.js`
2. Save the file
3. BrowserSync will reload the page automatically

### HTML Development
1. Edit `web/index.html`
2. Save the file  
3. BrowserSync will reload the page automatically

## 🐛 Troubleshooting

### BrowserSync Won't Start
- **Check if Clone Home is running** on port 3847
- **Check for port conflicts** - make sure port 3001 is available
- **Verify configuration** with `npm run browsersync:configs`

### Files Not Reloading
- **Check file paths** - make sure you're editing files in the `web/` directory
- **Check the console** for BrowserSync messages
- **Try manual reload** with `Ctrl+R` or `Cmd+R`

### Port Already in Use
If port 3001 is busy, you can:
1. Edit `libs/browser-sync/bs-config-clone-home.js`
2. Change the `port` value to something else (e.g., 3003)
3. Restart BrowserSync

## 🔗 URLs

When BrowserSync starts, you'll see these URLs:

- **Local**: `http://localhost:3001` - Your development URL
- **External**: `http://192.168.x.x:3001` - Access from other devices
- **UI**: `http://localhost:3002` - BrowserSync admin interface

## 💡 Tips

1. **Use the External URL** to test on mobile devices on the same network
2. **Use the UI URL** to access BrowserSync settings and tools
3. **Keep Clone Home running** - BrowserSync proxies to it, so it needs to be active
4. **Use CSS injection** - SCSS/CSS changes won't require a full page reload

## 🆘 Getting Help

```bash
# Show BrowserSync help
npm run browsersync:help

# List available configurations  
npm run browsersync:configs

# Check if configuration loads correctly
cd libs/browser-sync
node -e "console.log(require('./bs-config-clone-home.js'))"
```

## 🔄 Updating the Submodule

To update the BrowserSync submodule:

```bash
git submodule update --remote libs/browser-sync
cd libs/browser-sync
npm install  # Update dependencies if needed
```
