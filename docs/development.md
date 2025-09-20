# Development Guide

This guide covers development setup, testing, and contribution guidelines for Clone Home.

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- Git installed and configured
- GitHub Personal Access Token (for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/feralcreative/clone-home.git
cd clone-home

# Install dependencies
npm install

# Make CLI globally available (optional)
npm link
```

## Project Structure

```
clone-home/
├── src/                    # Core application code
│   ├── cli.js             # CLI entry point
│   ├── clone-home.js      # Main application logic
│   ├── config.js          # Configuration management
│   └── index.js           # Main entry point
├── web/                   # Web interface
│   ├── index.html         # Main HTML file
│   ├── app.js             # Frontend JavaScript
│   └── styles/            # SCSS styles
│       └── styles.scss    # Main stylesheet
├── test/                  # Test files
│   └── *.test.js          # Test suites
├── docs/                  # Documentation
├── examples/              # Example configurations
└── package.json           # Project configuration
```

## Development Commands

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test test/config.test.js
```

### Development Mode

```bash
# Start web interface in development mode
npm run dev

# Watch for SCSS changes
npm run watch-css
```

### Building CSS

The web interface uses SCSS for styling. To build the CSS:

```bash
# Build CSS once
npm run build-css

# Watch for changes and rebuild automatically
npm run watch-css

# Build everything (CSS + other assets)
npm run build
```

**Note**: The CSS file (`web/styles/styles.css`) is generated from `web/styles/styles.scss` and should not be edited directly.

## Testing

### Test Structure

Tests are located in the `test/` directory and use Node.js built-in test runner:

- `config.test.js` - Configuration management tests
- Add new test files following the `*.test.js` pattern

### Writing Tests

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { Config } from '../src/config.js';

test('should create config instance', () => {
  const config = new Config();
  assert.ok(config instanceof Config);
});
```

### Test Environment

Tests use a separate test configuration to avoid interfering with your actual Clone Home setup:

- Tests create temporary directories for configuration
- Environment variables are isolated during testing
- No actual GitHub API calls are made in unit tests

## Code Style

### JavaScript

- Use ES modules (`import`/`export`)
- Use modern JavaScript features (async/await, destructuring, etc.)
- Follow consistent naming conventions
- Add JSDoc comments for public functions

### SCSS

- Use semantic variable names
- Group related styles together
- Use consistent indentation (2 spaces)
- Comment complex styles

### Example Code Style

```javascript
/**
 * Load configuration from file
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfig(configPath) {
  try {
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}
```

## Contributing

### Before Contributing

1. **Check existing issues**: Look for related issues or feature requests
2. **Discuss major changes**: Open an issue to discuss significant changes
3. **Follow the code style**: Maintain consistency with existing code

### Contribution Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**
4. **Add tests**: Include tests for new functionality
5. **Run tests**: Ensure all tests pass with `npm test`
6. **Update documentation**: Update relevant documentation
7. **Commit changes**: Use clear, descriptive commit messages
8. **Push to your fork**: `git push origin feature/your-feature-name`
9. **Create a Pull Request**: Submit a PR with a clear description

### Commit Message Format

Use clear, descriptive commit messages:

```
feat: add auto-organization by language
fix: resolve path expansion issue on Windows
docs: update CLI guide with new commands
test: add tests for configuration loading
```

### Pull Request Guidelines

- **Clear title**: Summarize the change in the title
- **Detailed description**: Explain what changed and why
- **Link issues**: Reference related issues with `Fixes #123`
- **Screenshots**: Include screenshots for UI changes
- **Test coverage**: Ensure new code is tested

## Architecture

### Core Components

1. **Config Management** (`src/config.js`):
   - Handles configuration loading/saving
   - Manages environment variable integration
   - Provides path expansion utilities

2. **CLI Interface** (`src/cli.js`):
   - Command-line argument parsing
   - Interactive prompts
   - Progress indicators

3. **Core Logic** (`src/clone-home.js`):
   - GitHub API integration
   - Repository cloning logic
   - Organization and filtering

4. **Web Interface** (`web/`):
   - Express.js server
   - Frontend JavaScript
   - SCSS styling

### Design Principles

- **Separation of concerns**: Keep CLI, web, and core logic separate
- **Configuration flexibility**: Support both files and environment variables
- **Error handling**: Provide clear error messages and recovery options
- **User experience**: Prioritize ease of use and clear feedback
- **Cross-platform**: Support Windows, macOS, and Linux

## Debugging

### Debug Mode

Enable debug logging:

```bash
# Debug CLI commands
DEBUG=clone-home* npm start clone

# Debug web interface
DEBUG=clone-home* npm start web
```

### Common Debug Scenarios

1. **Configuration issues**: Check `~/.clone-home/config.json`
2. **GitHub API issues**: Verify token permissions and rate limits
3. **Path issues**: Test path expansion with different inputs
4. **Web interface issues**: Check browser console and network tab

## Release Process

### Version Management

1. **Update version**: `npm version patch|minor|major`
2. **Update changelog**: Document changes in CHANGELOG.md
3. **Test thoroughly**: Run full test suite
4. **Create release**: Tag and push to GitHub
5. **Publish**: `npm publish` (if applicable)

### Testing Before Release

```bash
# Run all tests
npm test

# Test CLI commands
npm start setup
npm start list -- --dry-run
npm start clone -- --dry-run

# Test web interface
npm start web
# Manual testing in browser

# Test with different configurations
# Test on different platforms (if possible)
```

## Security Considerations

### Token Handling

- Never log GitHub tokens
- Store tokens securely in user's home directory
- Use minimal required permissions
- Support token rotation

### Input Validation

- Validate all user inputs
- Sanitize file paths
- Prevent directory traversal attacks
- Validate GitHub API responses

### Dependencies

- Keep dependencies up to date
- Audit for security vulnerabilities: `npm audit`
- Use minimal dependencies when possible
- Pin dependency versions for stability

## Related Documentation

- **[Main README](../README.md)** - Project overview and quick start
- **[Web Interface Guide](web-interface.md)** - Visual drag-and-drop interface
- **[CLI Guide](cli-guide.md)** - Command-line interface documentation
- **[Usage Examples](../examples/README.md)** - Comprehensive examples and workflows
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
