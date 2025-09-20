# Clone Home Tests

This directory contains the test suite for Clone Home.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test test/config.test.js
```

## Test Structure

- `config.test.js` - Configuration management tests
- Add new test files following the `*.test.js` pattern

## Test Environment

Tests use a separate test configuration to avoid interfering with your actual Clone Home setup:

- Tests create temporary directories for configuration
- Environment variables are isolated during testing
- No actual GitHub API calls are made in unit tests

## Writing Tests

Tests use Node.js built-in test runner:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { Config } from '../src/config.js';

test('should create config instance', () => {
  const config = new Config();
  assert.ok(config instanceof Config);
});
```

## Test Guidelines

- Use descriptive test names
- Test both success and error cases
- Mock external dependencies (GitHub API, file system)
- Clean up any temporary files or state
- Use the TestConfig class for configuration tests to avoid .env loading

## Related Documentation

- **[Main README](../README.md)** - Project overview and quick start
- **[Development Guide](../docs/development.md)** - Complete development setup and guidelines
- **[Usage Examples](../configs/README.md)** - Comprehensive examples and workflows
