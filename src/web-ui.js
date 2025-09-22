import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { exec } from "child_process";
import chokidar from "chokidar";
import { CloneHome } from "./clone-home.js";
import { Config } from "./config.js";
import { CleanupManager } from "./cleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebUI {
  constructor(options = {}) {
    this.app = express();
    this.port = 3847;
    this.envWatcher = null;
    this.connectedClients = new Set();
    this.openBrowser = options.openBrowser !== false; // Default to true, can be disabled
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../web")));
  }

  setupRoutes() {
    // Serve static files from web directory
    this.app.use(express.static(path.join(__dirname, "../web")));

    // Serve the main page
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "../web/index.html"));
    });

    // API Routes
    this.app.get("/api/config", async (req, res) => {
      try {
        const config = new Config();
        const settings = await config.load();
        const envConfig = config.getEnvConfig();

        res.json({
          configured: !!settings,
          settings: settings
            ? {
                token: settings.token ? "***" : null, // Masked for security
                targetDir: settings.targetDir,
                includeOrgs: settings.includeOrgs,
                includeForks: settings.includeForks,
              }
            : null,
          envConfig: envConfig
            ? {
                hasToken: !!envConfig.token,
                hasTargetDir: !!envConfig.targetDir,
                hasIncludeOrgs: envConfig.includeOrgs !== undefined,
                hasIncludeForks: envConfig.includeForks !== undefined,
              }
            : null,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Server-Sent Events endpoint for real-time env file updates
    this.app.get("/api/env-status", (req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      // Send initial env status
      this.sendEnvStatus(res);

      // Add client to connected clients set
      this.connectedClients.add(res);

      // Remove client when connection closes
      req.on("close", () => {
        this.connectedClients.delete(res);
      });
    });

    this.app.post("/api/config", async (req, res) => {
      try {
        const config = new Config();

        // Filter out empty values - let .env values take precedence for empty fields
        const configToSave = {};
        const envConfig = config.getEnvConfig();

        // Only save non-empty values, or use env values as fallback
        if (req.body.token && req.body.token.trim()) {
          configToSave.token = req.body.token.trim();
        } else if (envConfig && envConfig.token) {
          configToSave.token = envConfig.token;
        }

        if (req.body.targetDir && req.body.targetDir.trim()) {
          configToSave.targetDir = req.body.targetDir.trim();
        } else if (envConfig && envConfig.targetDir) {
          configToSave.targetDir = envConfig.targetDir;
        }

        // For booleans, always use the provided value or env fallback
        configToSave.includeOrgs =
          req.body.includeOrgs !== undefined
            ? req.body.includeOrgs
            : envConfig && envConfig.includeOrgs !== undefined
            ? envConfig.includeOrgs
            : true;

        configToSave.includeForks =
          req.body.includeForks !== undefined
            ? req.body.includeForks
            : envConfig && envConfig.includeForks !== undefined
            ? envConfig.includeForks
            : false;

        await config.save(configToSave);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get("/api/repositories", async (req, res) => {
      try {
        const config = new Config();
        const settings = await config.load();

        if (!settings) {
          return res.status(400).json({ error: "Not configured" });
        }

        const cloneHome = new CloneHome(settings);
        const repositories = await cloneHome.getAllRepositories(req.query);

        res.json({ repositories });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get("/api/stats", async (req, res) => {
      try {
        const config = new Config();
        const settings = await config.load();

        if (!settings) {
          return res.status(400).json({ error: "Not configured" });
        }

        const cloneHome = new CloneHome(settings);
        const repositories = await cloneHome.getAllRepositories();

        const stats = {
          total: repositories.length,
          private: repositories.filter((r) => r.private).length,
          public: repositories.filter((r) => !r.private).length,
          forks: repositories.filter((r) => r.fork).length,
          languages: {},
          owners: {},
        };

        repositories.forEach((repo) => {
          const lang = repo.language || "Unknown";
          stats.languages[lang] = (stats.languages[lang] || 0) + 1;

          const owner = repo.owner.login;
          stats.owners[owner] = (stats.owners[owner] || 0) + 1;
        });

        res.json({ stats });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Organization config endpoints
    this.app.get("/api/organization", async (req, res) => {
      try {
        const config = new Config();
        const settings = await config.load();

        if (!settings) {
          return res.status(400).json({ error: "Configuration not found" });
        }

        // Try to load existing organization config
        const configPath = path.join(settings.targetDir, "repository-organization.json");
        let organizationConfig = {};

        try {
          if (await fs.pathExists(configPath)) {
            organizationConfig = await fs.readJson(configPath);
          }
        } catch (error) {
          console.log("No existing organization config found");
        }

        res.json({ organization: organizationConfig });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post("/api/organization", async (req, res) => {
      try {
        console.log("Received organization request:", {
          hasBody: !!req.body,
          bodyType: typeof req.body,
          bodyKeys: req.body ? Object.keys(req.body) : "none",
        });

        const { organization } = req.body;

        if (!organization || typeof organization !== "object") {
          console.log("Invalid organization data:", organization);
          return res.status(400).json({ error: "Invalid organization data" });
        }

        const config = new Config();
        const settings = await config.load();

        if (!settings) {
          return res.status(400).json({ error: "Configuration not found" });
        }

        // Validate and clean organization data
        const cleanOrganization = {};
        Object.entries(organization).forEach(([folderName, repos]) => {
          if (typeof folderName === "string" && folderName.trim() && Array.isArray(repos)) {
            const validRepos = repos.filter((repo) => typeof repo === "string" && repo.trim());
            if (validRepos.length > 0) {
              cleanOrganization[folderName.trim()] = validRepos;
            }
          }
        });

        // Save organization config
        const configPath = path.join(settings.targetDir, "repository-organization.json");
        await fs.ensureDir(settings.targetDir);
        await fs.writeJson(configPath, cleanOrganization, { spaces: 2 });

        console.log(`Saved organization config with ${Object.keys(cleanOrganization).length} folders`);
        res.json({ message: "Organization config saved successfully" });
      } catch (error) {
        console.error("Organization save error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Clone repositories endpoint
    this.app.post("/api/clone", async (req, res) => {
      try {
        const { dryRun = false } = req.body;

        const config = new Config();
        const settings = await config.load();

        if (!settings) {
          return res.status(400).json({ error: "Configuration not found. Please configure first." });
        }

        const cloneHome = new CloneHome(settings);
        const repositories = await cloneHome.getAllRepositories();

        if (dryRun) {
          res.json({
            message: `Would clone ${repositories.length} repositories to ${settings.targetDir}`,
            repositories: repositories.map((repo) => ({
              name: repo.name,
              full_name: repo.full_name,
              private: repo.private,
              language: repo.language,
              owner: {
                login: repo.owner.login,
              },
            })),
          });
        } else {
          // Start cloning process and return session ID
          const sessionId = Date.now().toString();

          // Start the clone process asynchronously with error handling
          this.startCloneProcess(sessionId, repositories, settings, cloneHome).catch((error) => {
            console.error(`Clone process failed for session ${sessionId}:`, error);
            // Send error to any connected SSE clients
            this.sendProgress(sessionId, {
              type: "error",
              message: `Clone process failed: ${error.message}`,
              error: error.message,
            });
          });

          res.json({
            message: `Starting clone process for ${repositories.length} repositories`,
            sessionId: sessionId,
            total: repositories.length,
          });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Clone progress endpoint (Server-Sent Events)
    this.app.get("/api/clone/progress/:sessionId", (req, res) => {
      const sessionId = req.params.sessionId;
      console.log(`SSE connection established for session: ${sessionId}`);

      // Set up SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      // Store the response object for this session
      if (!this.cloneSessions) {
        this.cloneSessions = new Map();
      }

      this.cloneSessions.set(sessionId, res);
      console.log(`Stored SSE connection for session ${sessionId}. Total sessions: ${this.cloneSessions.size}`);

      // Send any buffered progress events
      if (this.progressBuffer && this.progressBuffer.has(sessionId)) {
        const bufferedEvents = this.progressBuffer.get(sessionId);
        console.log(`Sending ${bufferedEvents.length} buffered events for session ${sessionId}`);

        bufferedEvents.forEach((data, index) => {
          try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            console.log(`Sent buffered event ${index + 1}/${bufferedEvents.length} for session ${sessionId}`);
          } catch (error) {
            console.error("Error sending buffered progress:", error);
          }
        });

        // Clear the buffer
        this.progressBuffer.delete(sessionId);
      }

      // Handle client disconnect
      req.on("close", () => {
        console.log(`SSE connection closed for session: ${sessionId}`);
        this.cloneSessions.delete(sessionId);
        // Clean up any remaining buffered events
        if (this.progressBuffer && this.progressBuffer.has(sessionId)) {
          this.progressBuffer.delete(sessionId);
        }
      });
    });

    // Uninstall endpoint - complete cleanup
    this.app.post("/api/uninstall", async (req, res) => {
      try {
        const cleanupManager = new CleanupManager();
        const config = new Config();
        const settings = await config.load();

        const cleanupLog = await cleanupManager.performFullCleanup({
          targetDir: settings?.targetDir,
          clonedRepositories: [], // No specific repositories, will clean up everything
          removeConfig: true, // Remove config files on uninstall
          verbose: true,
        });

        res.json({
          message: "Complete uninstall completed successfully",
          cleanupLog: cleanupLog,
        });
      } catch (error) {
        console.error("Error during uninstall:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Cancel clone endpoint
    this.app.post("/api/clone/cancel/:sessionId", async (req, res) => {
      const sessionId = req.params.sessionId;

      try {
        // Mark process as cancelled
        if (this.cloneProcesses && this.cloneProcesses.has(sessionId)) {
          const processInfo = this.cloneProcesses.get(sessionId);
          processInfo.cancelled = true;

          // Use comprehensive cleanup manager
          const cleanupManager = new CleanupManager();
          const config = new Config();
          const settings = await config.load();

          const cleanupLog = await cleanupManager.performFullCleanup({
            targetDir: settings?.targetDir,
            clonedRepositories: processInfo.results || [],
            removeConfig: false, // Don't remove config files on cancel
            verbose: true,
          });

          const removed = cleanupLog.filter((item) => item.action.includes("Removed"));

          this.cloneProcesses.delete(sessionId);

          // Send detailed cleanup information
          this.sendProgress(sessionId, {
            type: "cleanup_complete",
            message: `Cleanup completed: ${removed.length} repositories removed`,
            removed: removed,
          });
        }

        if (this.cloneSessions && this.cloneSessions.has(sessionId)) {
          const sseRes = this.cloneSessions.get(sessionId);
          sseRes.write(`data: ${JSON.stringify({ type: "cancelled" })}\n\n`);
          sseRes.end();
          this.cloneSessions.delete(sessionId);
        }

        res.json({ message: "Clone process cancelled and cleaned up" });
      } catch (error) {
        console.error("Error cancelling clone:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Undo clone endpoint
    this.app.post("/api/clone/undo", async (req, res) => {
      try {
        const { results } = req.body;

        if (!results || !Array.isArray(results)) {
          return res.status(400).json({ error: "No clone results provided" });
        }

        const removed = await this.cleanupClonedRepositories(results);

        res.json({
          message: `Successfully removed ${removed.length} repositories`,
          removed: removed,
        });
      } catch (error) {
        console.error("Error during undo:", error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async startCloneProcess(sessionId, repositories, settings, cloneHome) {
    console.log(`Starting clone process for session ${sessionId} with ${repositories.length} repositories`);

    if (!this.cloneProcesses) {
      this.cloneProcesses = new Map();
    }

    const processInfo = {
      cancelled: false,
      total: repositories.length,
      completed: 0,
      results: [],
    };

    this.cloneProcesses.set(sessionId, processInfo);

    let successCount = 0;
    let errorCount = 0;

    console.log(`Starting to clone ${repositories.length} repositories...`);

    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];

      // Check if process was cancelled
      if (processInfo.cancelled) {
        this.sendProgress(sessionId, {
          type: "cancelled",
          message: "Clone process was cancelled",
        });
        return;
      }

      // Send progress update
      console.log(`Cloning repository ${i + 1}/${repositories.length}: ${repo.full_name}`);
      this.sendProgress(sessionId, {
        type: "progress",
        current: i + 1,
        total: repositories.length,
        repository: repo.full_name,
        message: `Cloning ${repo.full_name}...`,
      });

      try {
        console.log(`Calling cloneRepository for ${repo.full_name}`);

        // Add progress callback for detailed clone feedback
        const cloneOptions = {
          onProgress: (progressData) => {
            // Send detailed progress updates to the client
            this.sendProgress(sessionId, {
              type: "clone_detail",
              repository: repo.full_name,
              progress: progressData,
              current: i + 1,
              total: repositories.length,
            });
          },
        };

        const result = await cloneHome.cloneRepository(repo, settings.targetDir, cloneOptions);
        console.log(`Clone result for ${repo.full_name}:`, result);

        // If there's an error, log it but continue with the process
        if (result.status === "error") {
          console.error(`Error cloning ${repo.full_name}: ${result.error}`);
        }

        let message;
        let status;

        switch (result.status) {
          case "cloned":
            message = `Successfully cloned to ${result.path}`;
            status = "success";
            successCount++;
            break;
          case "exists":
            message = `Already exists at ${result.path}`;
            status = "success";
            successCount++;
            break;
          case "error":
            message = result.error || "Clone failed";
            status = "error";
            errorCount++;
            break;
          default:
            message = `Unknown status: ${result.status}`;
            status = "error";
            errorCount++;
        }

        const repoResult = {
          name: repo.full_name,
          status: status,
          path: result.path,
          message: message,
        };

        processInfo.results.push(repoResult);
        processInfo.completed++;

        // Send individual repository result
        this.sendProgress(sessionId, {
          type: "repository_complete",
          repository: repoResult,
          progress: {
            current: i + 1,
            total: repositories.length,
            success: successCount,
            errors: errorCount,
          },
        });
      } catch (error) {
        console.error(`Unexpected error cloning ${repo.full_name}:`, error);

        const repoResult = {
          name: repo.full_name,
          status: "error",
          message: error.message,
        };

        processInfo.results.push(repoResult);
        processInfo.completed++;
        errorCount++;

        this.sendProgress(sessionId, {
          type: "repository_complete",
          repository: repoResult,
          progress: {
            current: i + 1,
            total: repositories.length,
            success: successCount,
            errors: errorCount,
          },
        });
      }
    }

    // Send completion message
    this.sendProgress(sessionId, {
      type: "complete",
      message: `Cloning completed: ${successCount} successful, ${errorCount} failed`,
      summary: {
        total: repositories.length,
        success: successCount,
        errors: errorCount,
      },
      results: processInfo.results,
    });

    // Clean up
    this.cloneProcesses.delete(sessionId);
    if (this.cloneSessions && this.cloneSessions.has(sessionId)) {
      this.cloneSessions.get(sessionId).end();
      this.cloneSessions.delete(sessionId);
    }
  }

  sendProgress(sessionId, data) {
    console.log(`Sending progress for session ${sessionId}:`, data);

    // Initialize progress buffer if it doesn't exist
    if (!this.progressBuffer) {
      this.progressBuffer = new Map();
    }

    if (this.cloneSessions && this.cloneSessions.has(sessionId)) {
      const res = this.cloneSessions.get(sessionId);
      console.log(`Found SSE connection for session ${sessionId}`);
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        console.log(`Successfully sent SSE data for session ${sessionId}`);
      } catch (error) {
        console.error("Error sending progress:", error);
        this.cloneSessions.delete(sessionId);
      }
    } else {
      console.log(`No SSE connection found for session ${sessionId}. Buffering progress event.`);

      // Buffer the progress event for when the SSE connection is established
      if (!this.progressBuffer.has(sessionId)) {
        this.progressBuffer.set(sessionId, []);
      }
      this.progressBuffer.get(sessionId).push(data);
    }
  }

  async cleanupClonedRepositories(results) {
    const fs = await import("fs-extra");
    const path = await import("path");
    const removed = [];

    if (!results || results.length === 0) {
      return removed;
    }

    console.log(`🧹 Cleaning up ${results.length} cloned repositories and removing them from disk...`);

    // Get the target directory from config
    const config = new (await import("./config.js")).Config();
    const settings = await config.load();
    const targetDir = settings?.targetDir;

    for (const result of results) {
      if (result.path) {
        try {
          if (await fs.pathExists(result.path)) {
            await fs.remove(result.path);
            console.log(`🗑️ Deleted repository and folder: ${result.path}`);
            removed.push({
              name: result.name,
              path: result.path,
            });
          }
        } catch (error) {
          console.error(`Failed to remove ${result.path}:`, error.message);
        }
      }
    }

    // After removing individual repositories, always check if we should remove the entire target directory
    if (targetDir) {
      try {
        if (await fs.pathExists(targetDir)) {
          // Check if the target directory is empty or only contains empty subdirectories
          const isEmpty = await this.isDirectoryEmptyRecursive(targetDir);
          if (isEmpty) {
            await fs.remove(targetDir);
            console.log(`🗑️ Removed empty target directory: ${targetDir}`);
          } else {
            console.log(`📁 Target directory ${targetDir} is not empty, keeping it`);
          }
        }
      } catch (error) {
        console.error(`Failed to remove target directory ${targetDir}:`, error.message);
      }
    }

    console.log(`✅ Cleanup completed: ${removed.length} repositories and their folders completely removed from disk`);
    return removed;
  }

  async isDirectoryEmptyRecursive(dirPath) {
    const fs = await import("fs-extra");

    try {
      const items = await fs.readdir(dirPath);

      if (items.length === 0) {
        return true;
      }

      // Check if all items are empty directories
      for (const item of items) {
        const itemPath = require("path").join(dirPath, item);
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
      console.error(`Error checking if directory is empty: ${error.message}`);
      return false;
    }
  }

  async forceCleanupTargetDirectory() {
    const fs = await import("fs-extra");

    try {
      // Get the target directory from config
      const config = new (await import("./config.js")).Config();
      const settings = await config.load();
      const targetDir = settings?.targetDir;

      if (targetDir && (await fs.pathExists(targetDir))) {
        // Check if the target directory is empty or only contains empty subdirectories
        const isEmpty = await this.isDirectoryEmptyRecursive(targetDir);
        if (isEmpty) {
          await fs.remove(targetDir);
          console.log(`🗑️ Force removed empty target directory: ${targetDir}`);
        } else {
          console.log(`📁 Target directory ${targetDir} contains files, keeping it`);
        }
      }
    } catch (error) {
      console.error(`Failed to force cleanup target directory:`, error.message);
    }
  }

  sendEnvStatus(res) {
    try {
      const config = new Config();
      const envConfig = config.getEnvConfig();

      const status = {
        hasToken: !!envConfig?.token,
        hasTargetDir: !!envConfig?.targetDir,
        hasIncludeOrgs: envConfig?.includeOrgs !== undefined,
        hasIncludeForks: envConfig?.includeForks !== undefined,
      };

      res.write(`data: ${JSON.stringify(status)}\n\n`);
    } catch (error) {
      console.error("Error sending env status:", error);
    }
  }

  broadcastEnvStatus() {
    for (const client of this.connectedClients) {
      this.sendEnvStatus(client);
    }
  }

  setupEnvWatcher() {
    const envPath = path.join(process.cwd(), ".env");

    // Watch for .env file changes, creation, and deletion
    this.envWatcher = chokidar.watch(envPath, {
      ignoreInitial: false,
      persistent: true,
    });

    this.envWatcher.on("add", () => {
      console.log(".env file created");
      this.broadcastEnvStatus();
    });

    this.envWatcher.on("change", () => {
      console.log(".env file changed");
      this.broadcastEnvStatus();
    });

    this.envWatcher.on("unlink", () => {
      console.log(".env file deleted");
      this.broadcastEnvStatus();
    });

    this.envWatcher.on("error", (error) => {
      console.error("Error watching .env file:", error);
    });
  }

  async start() {
    return new Promise((resolve) => {
      // Setup file watcher for .env file
      this.setupEnvWatcher();

      this.server = this.app.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        console.log(`🌐 Clone Home Web UI running at ${url}`);

        // Conditionally open browser
        if (this.openBrowser) {
          this.openBrowserWindow(url);
        } else {
          console.log(`💡 Browser opening disabled - server ready for BrowserSync`);
        }

        resolve();
      });
    });
  }

  openBrowserWindow(url) {
    const platform = process.platform;

    let command;
    switch (platform) {
      case "darwin": // macOS
        command = `open "${url}"`;
        break;
      case "win32": // Windows
        command = `start "" "${url}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${url}"`;
        break;
    }

    exec(command, (error) => {
      if (error) {
        console.log(`💡 Open your browser manually to: ${url}`);
      } else {
        console.log(`🚀 Opening browser automatically...`);
      }
    });
  }

  stop() {
    if (this.envWatcher) {
      this.envWatcher.close();
    }

    // Close all SSE connections
    for (const client of this.connectedClients) {
      client.end();
    }
    this.connectedClients.clear();

    if (this.server) {
      this.server.close();
    }
  }
}
