# Clone Home Examples & Usage Guide

This directory contains example configurations and comprehensive usage documentation for Clone Home.

## 📁 Example Configuration Files

- **[rules-based-organization.example.clonehome](rules-based-organization.example.clonehome)** - Rules-based automatic organization (by language, owner, patterns, etc.)
- **[manual-folder-organization.example.clonehome](manual-folder-organization.example.clonehome)** - Manual folder-based organization (explicit repository assignments)

## 🌐 Web Interface Usage (Recommended)

### 🚀 Quick Start with Web Interface

The easiest way to use Clone Home is through the visual web interface:

```bash
# Install dependencies and start web interface
npm install
npm start web
```

Your browser will automatically open to `http://localhost:3847` with the Clone Home interface.

### 📋 Step-by-Step Web Interface Workflow

#### 1. **Setup Tab - Initial Configuration**

1. Enter your GitHub Personal Access Token
2. Set your target directory (e.g., `~/repositories` or `~/Development/repos`)
3. Choose whether to include organization repositories
4. Choose whether to include forked repositories
5. Click "Save Configuration"

#### 2. **Repositories Tab - Browse Your Repos**

- View all your GitHub repositories in a clean table
- Use the search box to filter by name, language, or owner
- See repository details: language, visibility, description, last updated
- Get overview statistics of your repository collection

#### 3. **Organize Tab - Visual Organization**

- **Drag & Drop**: Drag repositories from the left panel into folders on the right
- **Create Folders**: Click "Add Folder" to create new organization folders
- **Auto-Organization Options**: Use one-click auto-organization:
  - **By Owner**: Groups repositories by GitHub owner/organization (e.g., `feralcreative/`, `mycompany/`)
  - **By Language**: Groups repositories by primary programming language (e.g., `javascript/`, `python/`)
  - **By Year**: Groups repositories by creation year (e.g., `2024/`, `2023/`)
- **Nested Folders**: Create structures like `work/client-projects` or `personal/side-projects`
- **Save Configuration**: Export your organization as a `.clonehome` file

#### 4. **Clone Tab - Execute Cloning**

- **Preview**: Click "Preview Clone" to see exactly what will be cloned
- **Clone**: Click "Start Cloning" to clone all repositories to your organized structure
- **Monitor Progress**: Watch real-time progress with success/error status for each repo

## 🤖 Auto-Organization Examples

### Auto-Organize by Owner

When you click "By Owner", repositories are automatically grouped by their GitHub owner:

**Before:**

```
📦 All Repositories (ungrouped)
├── feralcreative/clone-home
├── feralcreative/portfolio-site
├── mycompany/website
├── mycompany/mobile-app
└── opensource-org/library
```

**After:**

```
📁 feralcreative/
├── clone-home
└── portfolio-site
📁 mycompany/
├── website
└── mobile-app
📁 opensource-org/
└── library
```

### Auto-Organize by Language

When you click "By Language", repositories are grouped by their primary programming language:

**Before:**

```
📦 All Repositories (ungrouped)
├── react-dashboard (JavaScript)
├── python-scraper (Python)
├── go-microservice (Go)
├── vue-frontend (JavaScript)
└── data-analysis (Python)
```

**After:**

```
📁 javascript/
├── react-dashboard
└── vue-frontend
📁 python/
├── python-scraper
└── data-analysis
📁 go/
└── go-microservice
```

### Auto-Organize by Year

When you click "By Year", repositories are grouped by their creation year:

**Before:**

```
📦 All Repositories (ungrouped)
├── old-project (created 2022)
├── current-work (created 2024)
├── legacy-system (created 2021)
└── new-experiment (created 2024)
```

**After:**

```
📁 2021/
└── legacy-system
📁 2022/
└── old-project
📁 2025/
├── current-work
└── new-experiment
```

## 💻 Command Line Interface (CLI)

For advanced users who prefer command-line tools:

### Basic Commands

```bash
# Clone all repositories
npm start clone

# Preview what will be cloned (dry run)
npm start clone -- --dry-run

# List all repositories
npm start list

# Check status of local repositories
npm start status

# Interactive repository organization
npm start organize
```

### CLI Examples

#### Clone with Filters

```bash
# Only clone repositories matching a pattern
npm start clone -- --filter "my-project"

# Force overwrite existing directories
npm start clone -- --force
```

#### List Repositories with Filtering

```bash
# List all repositories
npm start list

# Filter repositories by name pattern
npm start list -- --filter "react"
```

## 📁 Configuration File Format

Clone Home uses `.clonehome` files to store repository organization configurations:

```json
{
  "version": "1.0",
  "created": "2025-01-20T10:30:00.000Z",
  "organization": {
    "work/client-projects": [
      "company/website",
      "company/mobile-app"
    ],
    "personal/side-projects": [
      "username/portfolio",
      "username/blog-engine"
    ]
  },
  "metadata": {
    "configName": "work-setup",
    "createdDate": "2025-01-20",
    "totalFolders": 2,
    "totalOrganizedRepos": 4
  }
}
```

## 🚀 Using Examples

1. **Copy example files**: Use the example configurations as starting points
2. **Modify for your needs**: Update repository names and folder structures
3. **Import in web interface**: Load `.clonehome` files in the Organize tab
4. **Share with team**: Distribute configurations for consistent setups

## 📝 Creating Your Own

1. **Use the web interface**: Create organization visually and export
2. **Name meaningfully**: Use descriptive names like `work-laptop-2025-01-20.clonehome`
3. **Version control**: Keep configurations in version control for team sharing
4. **Document purpose**: Add comments in the metadata about the configuration's purpose

## 🔗 Related Documentation

- **[Main README](../README.md)** - Project overview and quick start
- **[Web Interface Guide](../docs/web-interface.md)** - Detailed web interface documentation
- **[CLI Guide](../docs/cli-guide.md)** - Complete command-line reference
- **[Troubleshooting](../docs/troubleshooting.md)** - Common issues and solutions
- **[Development Guide](../docs/development.md)** - Contributing and development setup
