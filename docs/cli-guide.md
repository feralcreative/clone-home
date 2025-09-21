# Command Line Interface Guide

The Clone Home CLI provides powerful command-line tools for **organizing your local repositories** by cloning and managing your GitHub repositories locally. **Clone Home only reads from GitHub via API** - it never modifies anything on GitHub itself.

## Quick Reference

| Command | Description | Options |
|---------|-------------|---------|
| `setup` | Initial configuration | None |
| `clone` | Clone all repositories | `--dry-run`, `--force`, `--filter <pattern>` |
| `list` | List repositories | `--filter <pattern>` |
| `status` | Show local repository status | None |
| `organize` | Interactive repository organization | None |
| `web` | Start web interface | None |

## Commands

### Setup

Configure Clone Home with your GitHub credentials and preferences:

```bash
npm start setup
# or if globally installed:
clone-home setup
```

This will prompt you for:

- **GitHub Personal Access Token**: Your GitHub API token
- **Target Directory**: Where repositories will be cloned
- **Include Organizations**: Whether to include org repositories
- **Include Forks**: Whether to include forked repositories

Configuration is stored in `~/.clone-home/config.json`

### Clone All Repositories

Clone all your GitHub repositories:

```bash
npm start clone
# or: clone-home clone
```

### Preview What Will Be Cloned (Dry Run)

See what would be cloned without actually cloning:

```bash
npm start clone -- --dry-run
# or: clone-home clone --dry-run
```

### Clone with Filters

Filter repositories during cloning:

```bash
# Only clone repositories matching a pattern
npm start clone -- --filter "my-project"

# Clone repositories from specific owner
npm start clone -- --filter "mycompany/"

# Force overwrite existing directories
npm start clone -- --force

# Combine options
npm start clone -- --filter "react" --dry-run
```

### List All Repositories

View all your repositories without cloning:

```bash
npm start list
# or: clone-home list

# With filter
npm start list -- --filter "react"
```

### Check Status of Local Repositories

See which repositories are already cloned locally:

```bash
npm start status
# or: clone-home status
```

### Interactive Repository Organization

Launch the interactive organization interface:

```bash
npm start organize
# or: clone-home organize
```

This opens an interactive interface where you can:

- **Browse repositories** with pagination and filtering
- **Create directory tree rules** based on language, owner, patterns, etc.
- **Auto-organize** repositories by various criteria
- **Set custom paths** for specific repositories
- **Export repository lists** in multiple formats
- **View repository statistics** and analytics

## Directory Structure

### Default Structure

By default, repositories are organized in the following structure:

```text
repositories/
├── your-username/
│   ├── repo1/
│   └── repo2/
├── organization-name/
│   ├── org-repo1/
│   └── org-repo2/
└── another-user/
    └── forked-repo/
```

### Custom Directory Trees

You can create custom directory structures using two methods:

#### 1. Rules-Based Organization (`directory-tree.json`)

Create rules that automatically organize repositories based on criteria:

```json
{
  "rules": [
    {
      "type": "language",
      "value": "JavaScript",
      "directory": "languages/javascript"
    },
    {
      "type": "language",
      "value": "Python", 
      "directory": "languages/python"
    },
    {
      "type": "owner",
      "value": "mycompany",
      "directory": "work/company-projects"
    }
  ]
}
```

#### 2. Manual Folder Organization (`repository-organization.json`)

Manually specify where each repository should go:

```json
{
  "work/current-projects": [
    "mycompany/main-app",
    "mycompany/api-service"
  ],
  "personal/side-projects": [
    "username/portfolio-site",
    "username/weekend-hack"
  ],
  "experiments": [
    "username/ml-experiment",
    "username/new-framework-test"
  ]
}
```

Both configuration files are created and managed through the interactive `organize` command.

## Advanced Usage

### Filtering Patterns

The `--filter` option supports various patterns:

```bash
# Match repository names containing "api"
clone-home clone --filter "api"

# Match repositories from specific owner
clone-home clone --filter "mycompany/"

# Match repositories with specific language (requires organize command setup)
clone-home clone --filter "javascript"

# Match multiple patterns (separate with spaces)
clone-home clone --filter "api frontend"
```

### Force Operations

Use `--force` to overwrite existing repositories:

```bash
# Careful! This will overwrite existing repositories
clone-home clone --force

# Combine with dry-run to see what would be overwritten
clone-home clone --force --dry-run
```

### Organize Command Features

The `organize` command provides an interactive interface with the following capabilities:

- **📋 Browse and categorize repositories**: Page through your repositories with filtering options
- **🌳 Create directory tree configuration**: Set up rules for automatic organization
- **📁 Auto-organize by language/topic**: Automatically categorize repositories
- **💾 Save current organization**: Export your organization preferences
- **📤 Export repository list**: Generate reports in multiple formats (JSON, CSV, Markdown, Text)

## Configuration

Configuration is stored in `~/.clone-home/config.json`:

```json
{
  "token": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "targetDir": "/Users/username/repositories",
  "includeOrgs": true,
  "includeForks": false
}
```

## Environment Variables

You can also configure Clone Home using environment variables in a `.env` file:

```bash
# GitHub Personal Access Token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Target directory for cloned repositories
TARGET_DIR=~/repositories

# Include organization repositories (true/false)
INCLUDE_ORGS=true

# Include forked repositories (true/false)
INCLUDE_FORKS=false
```

## Examples

### Setting Up a New Development Machine

```bash
# 1. Configure Clone Home
clone-home setup

# 2. Preview what will be cloned
clone-home clone --dry-run

# 3. Clone everything
clone-home clone

# 4. Check status
clone-home status
```

### Selective Cloning

```bash
# Only clone work-related repositories
clone-home clone --filter "mycompany/"

# Only clone JavaScript projects
clone-home organize  # Set up language-based organization first
clone-home clone --filter "javascript"

# Clone specific projects
clone-home clone --filter "important-project"
```

### Repository Management

```bash
# List all repositories
clone-home list

# List filtered repositories
clone-home list --filter "react"

# Check what's already cloned
clone-home status

# Organize repositories interactively
clone-home organize
```

## Related Documentation

- **[Main README](../README.md)** - Project overview and quick start
- **[Web Interface Guide](web-interface.md)** - Visual drag-and-drop interface
- **[Usage Examples](../configs/README.md)** - Comprehensive examples and workflows
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Development Guide](development.md)** - Contributing and development setup
