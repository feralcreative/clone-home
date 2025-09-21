import fs from "fs-extra";
import path from "path";
import chalk from "chalk";

/**
 * Comprehensive cleanup utility for Clone Home
 * Handles removal of all files and directories created during clone operations
 */
export class CleanupManager {
  constructor() {
    this.cleanupLog = [];
  }

  /**
   * Perform comprehensive cleanup of all Clone Home artifacts
   * @param {Object} options - Cleanup options
   * @param {string} options.targetDir - Target directory path
   * @param {Array} options.clonedRepositories - List of cloned repositories
   * @param {boolean} options.removeConfig - Whether to remove configuration files
   * @param {boolean} options.verbose - Whether to log detailed information
   */
  async performFullCleanup(options = {}) {
    const { targetDir, clonedRepositories = [], removeConfig = false, verbose = true } = options;
    
    this.cleanupLog = [];
    
    if (verbose) {
      console.log(chalk.blue("🧹 Starting comprehensive cleanup..."));
    }

    // 1. Remove cloned repositories
    if (clonedRepositories.length > 0) {
      await this.cleanupRepositories(clonedRepositories, verbose);
    }

    // 2. Remove organization configuration file from target directory
    if (targetDir) {
      await this.cleanupOrganizationConfig(targetDir, verbose);
    }

    // 3. Remove directory tree configuration from current working directory
    await this.cleanupDirectoryTreeConfig(verbose);

    // 4. Remove target directory if empty
    if (targetDir) {
      await this.cleanupTargetDirectory(targetDir, verbose);
    }

    // 5. Remove configuration files if requested
    if (removeConfig) {
      await this.cleanupConfigFiles(verbose);
    }

    // 6. Clean up any empty parent directories
    if (targetDir) {
      await this.cleanupEmptyParentDirectories(targetDir, verbose);
    }

    if (verbose) {
      console.log(chalk.green(`✅ Cleanup completed: ${this.cleanupLog.length} items processed`));
      
      if (this.cleanupLog.length > 0) {
        console.log(chalk.dim("\nCleanup summary:"));
        this.cleanupLog.forEach(item => {
          console.log(chalk.dim(`  ${item.action}: ${item.path}`));
        });
      }
    }

    return this.cleanupLog;
  }

  /**
   * Remove cloned repositories
   */
  async cleanupRepositories(repositories, verbose = true) {
    for (const repo of repositories) {
      if (repo.path && await fs.pathExists(repo.path)) {
        try {
          await fs.remove(repo.path);
          this.cleanupLog.push({ action: "🗑️ Removed repository", path: repo.path });
          if (verbose) {
            console.log(chalk.yellow(`🗑️ Removed repository: ${repo.path}`));
          }
        } catch (error) {
          this.cleanupLog.push({ action: "❌ Failed to remove repository", path: repo.path, error: error.message });
          if (verbose) {
            console.error(chalk.red(`❌ Failed to remove ${repo.path}: ${error.message}`));
          }
        }
      }
    }
  }

  /**
   * Remove repository-organization.json from target directory
   */
  async cleanupOrganizationConfig(targetDir, verbose = true) {
    const orgConfigPath = path.join(targetDir, "repository-organization.json");
    
    if (await fs.pathExists(orgConfigPath)) {
      try {
        await fs.remove(orgConfigPath);
        this.cleanupLog.push({ action: "🗑️ Removed organization config", path: orgConfigPath });
        if (verbose) {
          console.log(chalk.yellow(`🗑️ Removed organization config: ${orgConfigPath}`));
        }
      } catch (error) {
        this.cleanupLog.push({ action: "❌ Failed to remove organization config", path: orgConfigPath, error: error.message });
        if (verbose) {
          console.error(chalk.red(`❌ Failed to remove organization config: ${error.message}`));
        }
      }
    }
  }

  /**
   * Remove directory-tree.json from current working directory
   */
  async cleanupDirectoryTreeConfig(verbose = true) {
    const treeConfigPath = path.join(process.cwd(), "directory-tree.json");
    
    if (await fs.pathExists(treeConfigPath)) {
      try {
        await fs.remove(treeConfigPath);
        this.cleanupLog.push({ action: "🗑️ Removed directory tree config", path: treeConfigPath });
        if (verbose) {
          console.log(chalk.yellow(`🗑️ Removed directory tree config: ${treeConfigPath}`));
        }
      } catch (error) {
        this.cleanupLog.push({ action: "❌ Failed to remove directory tree config", path: treeConfigPath, error: error.message });
        if (verbose) {
          console.error(chalk.red(`❌ Failed to remove directory tree config: ${error.message}`));
        }
      }
    }
  }

  /**
   * Remove target directory if empty
   */
  async cleanupTargetDirectory(targetDir, verbose = true) {
    if (await fs.pathExists(targetDir)) {
      try {
        const isEmpty = await this.isDirectoryEmptyRecursive(targetDir);
        if (isEmpty) {
          await fs.remove(targetDir);
          this.cleanupLog.push({ action: "🗑️ Removed empty target directory", path: targetDir });
          if (verbose) {
            console.log(chalk.yellow(`🗑️ Removed empty target directory: ${targetDir}`));
          }
        } else {
          this.cleanupLog.push({ action: "📁 Target directory not empty, kept", path: targetDir });
          if (verbose) {
            console.log(chalk.dim(`📁 Target directory not empty, kept: ${targetDir}`));
          }
        }
      } catch (error) {
        this.cleanupLog.push({ action: "❌ Failed to check/remove target directory", path: targetDir, error: error.message });
        if (verbose) {
          console.error(chalk.red(`❌ Failed to process target directory: ${error.message}`));
        }
      }
    }
  }

  /**
   * Remove Clone Home configuration files
   */
  async cleanupConfigFiles(verbose = true) {
    const { Config } = await import("./config.js");
    const config = new Config();
    const configPath = config.getConfigPath();
    
    if (await fs.pathExists(configPath)) {
      try {
        await fs.remove(configPath);
        this.cleanupLog.push({ action: "🗑️ Removed config file", path: configPath });
        if (verbose) {
          console.log(chalk.yellow(`🗑️ Removed config file: ${configPath}`));
        }
      } catch (error) {
        this.cleanupLog.push({ action: "❌ Failed to remove config file", path: configPath, error: error.message });
        if (verbose) {
          console.error(chalk.red(`❌ Failed to remove config file: ${error.message}`));
        }
      }
    }
  }

  /**
   * Clean up empty parent directories
   */
  async cleanupEmptyParentDirectories(targetDir, verbose = true) {
    let currentDir = path.dirname(targetDir);
    const rootDir = path.parse(currentDir).root;
    
    // Don't go above the user's home directory or root
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    
    while (currentDir !== rootDir && currentDir !== homeDir && currentDir.length > rootDir.length) {
      try {
        if (await fs.pathExists(currentDir)) {
          const isEmpty = await this.isDirectoryEmptyRecursive(currentDir);
          if (isEmpty) {
            await fs.remove(currentDir);
            this.cleanupLog.push({ action: "🗑️ Removed empty parent directory", path: currentDir });
            if (verbose) {
              console.log(chalk.dim(`🗑️ Removed empty parent directory: ${currentDir}`));
            }
            currentDir = path.dirname(currentDir);
          } else {
            break; // Stop if directory is not empty
          }
        } else {
          break; // Stop if directory doesn't exist
        }
      } catch (error) {
        if (verbose) {
          console.error(chalk.red(`❌ Failed to process parent directory ${currentDir}: ${error.message}`));
        }
        break;
      }
    }
  }

  /**
   * Check if directory is empty recursively
   */
  async isDirectoryEmptyRecursive(dirPath) {
    try {
      const items = await fs.readdir(dirPath);
      
      if (items.length === 0) {
        return true;
      }
      
      // Check if all items are empty directories
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isFile()) {
          return false; // Found a file, directory is not empty
        }
        
        if (stat.isDirectory()) {
          const isEmpty = await this.isDirectoryEmptyRecursive(itemPath);
          if (!isEmpty) {
            return false; // Found a non-empty subdirectory
          }
        }
      }
      
      return true; // All subdirectories are empty
    } catch (error) {
      console.warn(`Warning: Could not check if directory is empty: ${error.message}`);
      return false; // Assume not empty if we can't check
    }
  }

  /**
   * Get cleanup log
   */
  getCleanupLog() {
    return this.cleanupLog;
  }
}
