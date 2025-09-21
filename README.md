# <img src="web/assets/images/lockup-clone-home.png" alt="Clone Home" width="400">

A powerful tool that clones and organizes all your GitHub repositories (or a subset thereof) based on your custom configuration.

With Clone Home, you can instantly replicate your entire development environment on a new machine in seconds.

![Clone Home Web Interface](web/assets/images/screenshot.png)

## ✨ Key Features

- **🌐 Web Interface**: Drag-and-drop organization with visual folder management
- **🖥️ Command Line**: Powerful CLI with filtering, dry-run, and automation
- **🤖 Auto-Organization**: One-click organization by owner, language, or year
- **💾 Configuration Exports**: Save both `.env` files and `.clonehome` organization files from the web interface
- **🔍 Smart Filtering**: Advanced search and filtering capabilities
- **⚡ One-Click Cloning**: Clone all repositories with a single command
- **🛡️ Safe Operations**: Preview mode and safety checks prevent accidents

## 🎯 What Clone Home Does

**Clone Home is for LOCAL repository organization:**

✅ **What it DOES:**

- Downloads/clones your GitHub repositories to your local machine
- Organizes them into custom folder structures locally
- Reads repository information via GitHub API (read-only)
- Creates local `.env` and `.clonehome` configuration files
- Manages your local development environment setup

❌ **What it does NOT do:**

- Modify anything on GitHub (repos, settings, etc.)
- Push changes back to GitHub
- Create or delete repositories on GitHub
- Change GitHub repository settings or permissions

**It's simply a smart way to download and organize all your GitHub repos locally.**

## 🚀 Quick Start

### Web Interface (Recommended)

```bash
npm install
npm start web
```

Open `http://localhost:3847` and follow the Setup → Organize → Clone workflow.

### Command Line

```bash
npm install
npm start setup  # Configure GitHub token and preferences
npm start clone  # Clone all repositories
```

## Installation

**Prerequisites**: Node.js 18.0.0+, Git, GitHub Personal Access Token

```bash
npm install
npm link  # Optional: make CLI globally available
```

## Setup

1. **Create GitHub Personal Access Token** with `repo` and `read:org` scopes
2. **Configure Clone Home**: `npm start setup`

Configuration is stored in `~/.clone-home/config.json`

## 📚 Documentation

- **[Web Interface Guide](docs/web-interface.md)** - Complete guide to using the drag-and-drop web interface
- **[Command Line Guide](docs/cli-guide.md)** - Detailed CLI usage, commands, and configs
- **[Performance Analysis](docs/performance-analysis.md)** - Memory usage and optimization details
- **[Troubleshooting Guide](docs/troubleshooting.md)** - Common issues and solutions
- **[Development Guide](docs/development.md)** - Development setup and contribution guidelines
- **[Usage Examples & Configuration](configs/README.md)** - Comprehensive examples, workflows, and configuration files

## 🌐 Web Interface

Start the web interface: `npm start web` → Open `http://localhost:3847`

**Features**: Setup → Browse Repositories → Organize with Drag & Drop → **Export Both .env & .clonehome Files** → Clone

**Key Advantage**: The web interface can export **both** configuration file types:

- **`.env` files** with your GitHub token and settings
- **`.clonehome` files** with your repository organization structure

Perfect for setting up new development machines with complete configuration!

## �️ Command Line

Basic commands:

```bash
npm start setup   # Configure GitHub token and preferences
npm start list    # List all repositories
npm start clone   # Clone all repositories
npm start status  # Check local repository status
```

**Advanced**: Use `--filter`, `--dry-run`, and `--force` options for precise control.

## Configuration

Configuration is stored in `~/.clone-home/config.json`. **The web interface provides dual export capabilities:**

- **`.env` files**: Export your GitHub token and settings for easy project setup
- **`.clonehome` files**: Save and share your repository organization structure

This allows you to quickly set up new development environments with both authentication and folder organization in place.

## Security

- **Read-only operations**: Clone Home only reads from GitHub via API - never writes or modifies
- GitHub tokens are stored locally in the project's `.env` file
- Tokens are never logged or transmitted anywhere except to GitHub's API
- Use tokens with minimal required permissions (`repo` and `read:org` scopes only)
- All operations are local to your machine - nothing is sent back to GitHub

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
