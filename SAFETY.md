# Clone Home Safety Mechanisms

## 🛡️ Safety Guarantee

**Clone Home is designed to NEVER overwrite existing files or folders.** This document outlines the comprehensive safety mechanisms in place to prevent data loss.

## 🔒 Core Safety Mechanisms

### 1. **Existing Directory Protection**
- **Check**: Before cloning any repository, Clone Home checks if the target directory already exists
- **Action**: If a directory exists, Clone Home will:
  - ✅ **Skip cloning** and report "already exists" if it's a git repository
  - 🚫 **Block cloning** and report "blocked" if it's not a git repository (could contain user files)
- **Result**: No existing directories are ever overwritten

### 2. **Git Repository Detection**
- **Check**: When a directory exists, Clone Home verifies if it contains a `.git` folder
- **Logic**: 
  - If `.git` exists → Safe to skip (it's already a git repository)
  - If `.git` doesn't exist → Block operation (could be user files)
- **Result**: User files and non-git directories are protected

### 3. **No Force Option in Web Interface**
- **Design**: The web interface does NOT expose any "force" or "overwrite" options
- **Implementation**: The web API only passes safe options to the cloning process
- **Result**: Users cannot accidentally overwrite files through the web interface

### 4. **Force Option Removed from CLI**
- **Change**: The dangerous `--force` option has been removed from the CLI
- **Previous Risk**: Could have overwritten existing directories
- **Current State**: No way to force overwrite through any interface

### 5. **Parent Directory Creation Only**
- **Behavior**: Clone Home only creates parent directories that don't exist
- **Safety**: Uses `fs.ensureDir(path.dirname(repoPath))` which only creates missing parent folders
- **Result**: Never modifies existing directory contents

## 📊 Clone Status Types

Clone Home uses specific status codes to communicate what happened:

| Status | Meaning | Safety Level |
|--------|---------|--------------|
| `cloned` | Successfully cloned to new directory | ✅ Safe |
| `exists` | Directory exists and is a git repository | ✅ Safe (skipped) |
| `blocked` | Directory exists but is not a git repository | 🛡️ Protected (blocked) |
| `error` | Clone failed due to network/permission issues | ⚠️ No changes made |

## 🔍 Pre-Clone Validation

Before any cloning operation:

1. **Path Resolution**: Determines exact target path based on organization config
2. **Existence Check**: Verifies if target directory exists
3. **Git Detection**: Checks for `.git` folder if directory exists
4. **Safety Decision**: Proceeds only if safe to do so

## 🚨 What Clone Home Will NEVER Do

- ❌ Overwrite existing files
- ❌ Delete existing directories
- ❌ Modify existing folder contents
- ❌ Force clone over existing non-git directories
- ❌ Remove user data

## ✅ What Clone Home WILL Do

- ✅ Create new directories for repositories
- ✅ Skip existing git repositories safely
- ✅ Block operations that could cause data loss
- ✅ Provide clear status messages about what happened
- ✅ Clean up partial clones if they fail

## 🧪 Testing Safety

You can verify these safety mechanisms:

1. **Create a test directory** with some files
2. **Try to clone** a repository to that location
3. **Observe**: Clone Home will block the operation and report "blocked" status
4. **Verify**: Your original files remain untouched

## 🔧 Implementation Details

### Code Location: `src/clone-home.js`
```javascript
// SAFETY CHECK: Never overwrite existing directories
if (await fs.pathExists(repoPath)) {
  const gitPath = path.join(repoPath, '.git');
  const isGitRepo = await fs.pathExists(gitPath);
  
  if (isGitRepo) {
    return { status: "exists", path: repoPath };
  } else {
    return { 
      status: "blocked", 
      path: repoPath, 
      message: "Directory exists but is not a git repository. Will not overwrite to prevent data loss." 
    };
  }
}
```

### Web Interface Protection: `src/web-ui.js`
- No force options exposed in API
- Handles "blocked" status gracefully
- Provides clear user feedback

## 📝 Safety Audit Trail

Every clone operation is logged with:
- Target path
- Operation result
- Safety decision made
- Reason for blocking (if applicable)

## 🆘 Emergency Procedures

If you ever need to remove cloned repositories:
- Use the built-in "Undo" feature in the web interface
- Use the cleanup commands in the CLI
- Manually delete only the git repositories you cloned

**Remember**: Clone Home's safety mechanisms protect your existing files, but you should always backup important data before any bulk operations.
