import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { exec } from "child_process";
import { CloneHome } from "./clone-home.js";
import { Config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebUI {
  constructor() {
    this.app = express();
    this.port = 3000;
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
              name: repo.full_name,
              private: repo.private,
              language: repo.language,
            })),
          });
        } else {
          // Implement actual cloning
          const results = [];
          let successCount = 0;
          let errorCount = 0;

          for (const repo of repositories) {
            try {
              const result = await cloneHome.cloneRepository(repo, settings.targetDir);

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

              results.push({
                name: repo.full_name,
                status: status,
                path: result.path,
                message: message,
              });
            } catch (error) {
              results.push({
                name: repo.full_name,
                status: "error",
                message: error.message,
              });
              errorCount++;
            }
          }

          res.json({
            message: `Cloning completed: ${successCount} successful, ${errorCount} failed`,
            summary: { total: repositories.length, success: successCount, errors: errorCount },
            results,
          });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        console.log(`🌐 Clone Home Web UI running at ${url}`);

        // Automatically open browser
        this.openBrowser(url);

        resolve();
      });
    });
  }

  openBrowser(url) {
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
    if (this.server) {
      this.server.close();
    }
  }
}
