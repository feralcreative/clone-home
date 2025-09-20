# Troubleshooting Guide

This guide covers common issues and solutions for Clone Home.

## Web Interface Issues

### 🌐 Web Interface Won't Start

**Symptoms**: Web interface fails to start or shows errors

**Solutions**:
- **Check Node.js version**: Ensure you have Node.js 18.0.0 or higher
- **Port conflicts**: If port 3847 is in use, the interface will try alternative ports
- **Check dependencies**: Run `npm install` to ensure all dependencies are installed
- **Clear cache**: Try `rm -rf node_modules package-lock.json && npm install`

```bash
# Check Node.js version
node --version

# Check if port 3847 is in use
lsof -i :3847

# Try starting on a different port
PORT=3001 npm start web

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### 🔑 Authentication Problems in Web Interface

**Symptoms**: "Not configured" error, empty repository list, or authentication failures

**Solutions**:
1. **Token not working**: Verify your GitHub token in Setup tab
2. **"Not configured" error**: Complete all fields in Setup tab
3. **Empty repository list**: Check token permissions (`repo`, `read:org`)
4. **Rate limit errors**: Wait a few minutes and try again

### 🖱️ Drag & Drop Not Working

**Symptoms**: Cannot drag repositories between folders

**Solutions**:
- **Use modern browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Enable JavaScript**: Ensure JavaScript is enabled in your browser
- **Clear cache**: Try refreshing the page or clearing browser cache
- **Check console**: Open browser dev tools (F12) and check for errors

### 📁 Clone Process Issues

**Symptoms**: Cloning fails or repositories don't appear in expected locations

**Solutions**:

```bash
# Check network connection and Git configuration
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Check directory permissions
ls -la ~/repositories

# Verify disk space
df -h
```

**Common causes**:
- Network connectivity issues
- Insufficient disk space
- Git not configured properly
- Directory permission problems
- **Clone button does nothing**: Check browser console for errors; verify configuration
- **Partial clones**: Some repositories may fail due to permissions or network issues
- **"Clone failed" errors**: Check the detailed error messages for specific repository issues

## Command Line Issues

### 🔑 Authentication Issues

**Symptoms**: 401 Unauthorized, 403 Forbidden, or "Bad credentials" errors

**Solutions**:

```bash
# Reconfigure your token
npm start setup

# Verify token permissions in GitHub:
# - repo (for private repositories)
# - read:org (for organization repositories)
```

**Token troubleshooting**:
- Verify your GitHub token has the correct permissions
- Check if the token has expired
- Ensure the token is copied correctly (no extra spaces)
- Try creating a new token if the current one doesn't work

### 💾 Disk Space Issues

**Symptoms**: "No space left on device" or cloning stops unexpectedly

**Solutions**:

```bash
# Check available disk space
df -h

# Check what you have locally before cloning more
npm start status

# Use filters to clone only what you need
npm start clone -- --filter "active-project"

# Clean up unnecessary repositories
rm -rf ~/repositories/unused-repo
```

### 🛡️ Permission Errors

**Symptoms**: "Permission denied" errors when cloning or accessing directories

**Solutions**:
- Make sure the target directory is writable
- Check if any repositories require special access permissions
- Verify your GitHub token has access to private repositories

```bash
# Check directory permissions
ls -la ~/repositories

# Fix permissions if needed
chmod 755 ~/repositories
```

## Common Solutions

### 🔧 Reset Configuration

If you're experiencing persistent issues, try resetting your configuration:

```bash
# Remove configuration and start fresh
rm -rf ~/.clone-home
npm start setup
```

### 🐛 Debug Mode

Enable debug logging to get more detailed error information:

```bash
# Set debug environment variable
DEBUG=clone-home* npm start clone

# Or for web interface
DEBUG=clone-home* npm start web
```

### 📊 Check Logs

For web interface issues:
- Open browser developer tools (F12) and check the Console tab
- Look for error messages in the terminal where you started the web interface
- Check network requests in the browser's Network tab

## Specific Error Messages

### "GitHub API rate limit exceeded"

**Solution**: Wait for the rate limit to reset (usually 1 hour) or use a different GitHub token.

### "Repository not found" or "404 Not Found"

**Possible causes**:
- Repository was deleted or made private
- Your token doesn't have access to the repository
- Repository name changed

**Solution**: Check the repository exists and your token has appropriate permissions.

### "Git clone failed"

**Possible causes**:
- Network connectivity issues
- Repository is too large
- Git is not installed or configured

**Solutions**:
```bash
# Check Git installation
git --version

# Test Git connectivity
git clone https://github.com/octocat/Hello-World.git test-clone
rm -rf test-clone

# Check Git configuration
git config --list
```

### "ENOENT: no such file or directory"

**Possible causes**:
- Target directory doesn't exist
- Path contains invalid characters
- Permission issues

**Solutions**:
```bash
# Create target directory
mkdir -p ~/repositories

# Check path validity
echo "Target: ~/repositories"
ls -la ~/repositories
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs**: Look for error messages in the console or terminal
2. **Try with minimal configuration**: Use default settings to isolate the issue
3. **Test with a single repository**: Use `--filter` to test with one repository
4. **Check GitHub status**: Visit [GitHub Status](https://www.githubstatus.com/) for API issues
5. **Update dependencies**: Run `npm update` to ensure you have the latest versions

## Performance Tips

### Large Repository Collections

If you have many repositories:

- Use filters to clone in batches
- Consider using `--dry-run` first to estimate time and space
- Clone during off-peak hours for better network performance
- Use SSD storage for better Git performance

### Network Optimization

- Use wired connection instead of WiFi when possible
- Close other network-intensive applications
- Consider cloning during off-peak hours
- Use `git config --global http.postBuffer 524288000` for large repositories

## Related Documentation

- **[Main README](../README.md)** - Project overview and quick start
- **[Web Interface Guide](web-interface.md)** - Visual drag-and-drop interface
- **[CLI Guide](cli-guide.md)** - Command-line interface documentation
- **[Usage Examples](../configs/README.md)** - Comprehensive examples and workflows
- **[Development Guide](development.md)** - Contributing and development setup
