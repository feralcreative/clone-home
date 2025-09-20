#!/bin/bash

# Clone Home Setup Script
# This script helps set up the Clone Home application

set -e

echo "🏠 Clone Home Setup"
echo "=================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "clone-home" package.json 2>/dev/null; then
    echo "❌ This doesn't appear to be the Clone Home directory."
    echo "Please run this script from the Clone Home project root."
    echo "Expected files: package.json, src/, web/"
    exit 1
fi

echo "✅ Clone Home directory detected"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js 18.0.0 or higher from https://nodejs.org/"
    echo ""
    echo "On macOS with Homebrew:"
    echo "  brew install node"
    echo ""
    echo "On Ubuntu/Debian:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! node -e "process.exit(process.version.slice(1).split('.').map(Number).reduce((a,b,i)=>(a<<8)+b) >= '${REQUIRED_VERSION}'.split('.').map(Number).reduce((a,b,i)=>(a<<8)+b) ? 0 : 1)"; then
    echo "❌ Node.js version ${NODE_VERSION} is too old."
    echo "Please upgrade to Node.js ${REQUIRED_VERSION} or higher."
    exit 1
fi

echo "✅ Node.js ${NODE_VERSION} detected"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available."
    echo "Please install npm or use yarn/pnpm instead."
    exit 1
fi

echo "✅ npm detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed successfully!"

# Build CSS for web interface
echo "🎨 Building CSS for web interface..."
# Give npm a moment to finish installing
sleep 1
if npx sass web/styles.scss web/styles.css 2>/dev/null; then
    echo "✅ CSS compiled successfully!"
else
    echo "⚠️  CSS compilation failed, trying alternative method..."
    if npm run build-css 2>/dev/null; then
        echo "✅ CSS compiled successfully!"
    else
        echo "⚠️  CSS compilation failed, but continuing setup..."
        echo "You can manually run 'npm run build-css' after setup completes"
    fi
fi

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "⚠️  Git is not installed. You'll need Git to clone repositories."
    echo "Please install Git from https://git-scm.com/"
else
    echo "✅ Git detected"
fi

# Verify setup
echo ""
echo "🔍 Verifying setup..."

# Check if CSS was built
if [ -f "web/styles.css" ]; then
    echo "✅ CSS file exists"
else
    echo "⚠️  CSS file missing - web interface may not work properly"
fi

# Check if main files exist
if [ -f "src/cli.js" ] && [ -f "web/index.html" ] && [ -f "web/app.js" ]; then
    echo "✅ Core files present"
else
    echo "⚠️  Some core files may be missing"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🌐 Web Interface (Recommended):"
echo "1. Run 'npm start web' to launch the web interface"
echo "2. Open your browser to http://localhost:3000"
echo "3. Configure your GitHub token and preferences in the Setup tab"
echo "4. Organize and clone your repositories visually!"
echo ""
echo "🖥️  Command Line Interface:"
echo "1. Run 'npm start setup' to configure your GitHub token"
echo "2. Run 'npm start clone' to clone all your repositories"
echo ""
echo "📚 For more help:"
echo "• Run 'npm start -- --help' for CLI options"
echo "• Check README.md for detailed documentation"
echo "• Visit the web interface for the easiest experience"
