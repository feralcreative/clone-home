# Web Interface Guide

The Clone Home web interface provides an intuitive, visual way to manage your GitHub repositories with drag-and-drop organization and one-click cloning.

## Getting Started

### Starting the Web Interface

```bash
npm start web
# or if globally installed:
clone-home web
```

The web interface will be available at `http://localhost:3000`

## Interface Overview

### 📋 Setup Tab

- **GitHub Token Configuration**: Securely enter your GitHub personal access token
- **Target Directory Setup**: Choose where repositories will be cloned (supports `~/` for home directory)
- **Repository Options**: Configure organization and fork inclusion settings
- **Environment Integration**: Visual indicators show when settings are available in `.env` files

### 📊 Repositories Tab

- **Repository Browser**: View all your GitHub repositories in a clean, searchable table
- **Advanced Filtering**: Search by name, language, owner, or visibility status
- **Repository Details**: See language, visibility, description, and last updated information
- **Statistics Dashboard**: Get overview statistics of your repository collection
- **Sorting Options**: Sort by name, language, updated date, or owner

### 🎨 Organize Tab

- **Drag & Drop Interface**: Visually organize repositories by dragging them into folders
- **Folder Management**: Create, rename, and delete organization folders
- **Auto-Organization**: Use one-click auto-organization options:
  - **By Owner**: Groups repositories by GitHub owner/organization (e.g., `feralcreative/`, `mycompany/`)
  - **By Language**: Groups repositories by primary programming language (e.g., `javascript/`, `python/`)
  - **By Year**: Groups repositories by creation year (e.g., `2024/`, `2023/`)
- **Nested Folders**: Create complex structures like `work/client-projects` or `personal/side-projects`
- **Configuration Export**: Save your organization as a `.clonehome` file for reuse

### ⚡ Clone Tab

- **Clone Preview**: See exactly what will be cloned and where before starting
- **One-Click Cloning**: Clone all repositories with a single button click
- **Real-time Progress**: Watch as each repository is cloned with detailed status updates
- **Detailed Results**: See success/failure status for each repository with file paths
- **Error Handling**: Clear error messages for any repositories that fail to clone

## Workflow

1. **Setup**: Configure your GitHub token and preferences in the Setup tab
2. **Browse**: View all your repositories in the Repositories tab
3. **Organize**: Use drag & drop in the Organize tab to create your ideal folder structure
4. **Save**: Export your organization configuration as a `.clonehome` file
5. **Clone**: Use the Clone tab to preview and execute the cloning process
6. **Repeat**: Load saved configurations on new machines for consistent setups

## Configuration Files

The web interface creates `.clonehome` configuration files that contain your repository organization:

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

## Tips & Best Practices

### Organizing Repositories Efficiently

- **Start with broad categories**: Create main folders like `work`, `personal`, `experiments`, `archived`
- **Use descriptive names**: Folder names like `client-projects` or `learning-resources` are clearer than generic names
- **Leverage auto-organization**: Use the auto-organize buttons as starting points:
  - **By Owner**: Great for separating personal vs company repositories
  - **By Language**: Useful for language-specific development workflows
  - **By Year**: Helpful for archiving older projects or tracking project timeline
- **Combine approaches**: Start with auto-organization, then manually refine the structure
- **Save frequently**: Export configurations regularly to avoid losing organization work

### Configuration Management

- **Use meaningful names**: `work-laptop-2025-01-20.clonehome` vs `config.clonehome`
- **Version your configs**: The date suffix helps track changes over time
- **Share team configs**: Distribute `.clonehome` files for consistent team setups
- **Backup important configs**: Store in cloud storage or version control

### Cloning Efficiency

- **Preview first**: Always use "Preview Clone" to verify your setup before cloning
- **Check disk space**: Ensure you have sufficient disk space for all repositories
- **Network considerations**: Large repository collections may take time to clone
- **Incremental setup**: Consider cloning in batches for very large repository collections

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + F` | Focus search/filter input |
| `Tab` | Navigate between interface elements |
| `Enter` | Confirm dialogs and forms |
| `Escape` | Cancel dialogs and clear filters |

## Browser Compatibility

The web interface is tested and supported on:

- ✅ **Chrome** 90+
- ✅ **Firefox** 88+
- ✅ **Safari** 14+
- ✅ **Edge** 90+

## Mobile Support

The web interface is fully responsive and works on:

- 📱 **Mobile phones** (iOS Safari, Android Chrome)
- 📱 **Tablets** (iPad, Android tablets)
- 💻 **Desktop browsers** (all major browsers)

## Advanced Features

### Environment Variable Integration

The web interface can read configuration from `.env` files and will show visual indicators when settings are available from environment variables. This is useful for:

- Team standardization
- CI/CD integration
- Consistent development environments

### Auto-Organization Examples

See the [usage examples](../examples/README.md) for detailed before/after examples of each auto-organization option.

## Related Documentation

- **[Main README](../README.md)** - Project overview and quick start
- **[CLI Guide](cli-guide.md)** - Command-line interface documentation
- **[Usage Examples](../examples/README.md)** - Comprehensive examples and workflows
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Development Guide](development.md)** - Contributing and development setup
