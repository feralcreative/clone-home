import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";
import dotenv from "dotenv";

export class Config {
  constructor() {
    this.configDir = path.join(os.homedir(), ".clone-home");
    this.configFile = path.join(this.configDir, "config.json");

    // Load environment variables from .env file if it exists
    this.loadEnvFile();
  }

  loadEnvFile() {
    try {
      // Try to load .env file from current working directory
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
      }
    } catch (error) {
      // Silently ignore .env loading errors
    }
  }

  getEnvConfig() {
    const envConfig = {};
    let hasEnvValues = false;

    if (process.env.GITHUB_TOKEN) {
      envConfig.token = process.env.GITHUB_TOKEN;
      hasEnvValues = true;
    }

    if (process.env.TARGET_DIR) {
      let targetDir = process.env.TARGET_DIR;
      // Expand target directory path
      if (targetDir.startsWith("~")) {
        targetDir = targetDir.replace("~", os.homedir());
      }
      envConfig.targetDir = path.resolve(targetDir);
      hasEnvValues = true;
    }

    if (process.env.INCLUDE_ORGS !== undefined) {
      envConfig.includeOrgs = process.env.INCLUDE_ORGS === "true";
      hasEnvValues = true;
    }

    if (process.env.INCLUDE_FORKS !== undefined) {
      envConfig.includeForks = process.env.INCLUDE_FORKS === "true";
      hasEnvValues = true;
    }

    return hasEnvValues ? envConfig : null;
  }

  async save(config) {
    try {
      // Ensure config directory exists
      await fs.ensureDir(this.configDir);

      // Validate required fields
      if (!config.token) {
        throw new Error("GitHub token is required");
      }

      // Expand target directory path
      if (config.targetDir.startsWith("~")) {
        config.targetDir = config.targetDir.replace("~", os.homedir());
      }
      config.targetDir = path.resolve(config.targetDir);

      // Save configuration
      await fs.writeJson(this.configFile, config, { spaces: 2 });

      console.log(chalk.dim(`Configuration saved to: ${this.configFile}`));
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  async load() {
    try {
      let config = {};

      // First, try to load from config file
      if (await fs.pathExists(this.configFile)) {
        config = await fs.readJson(this.configFile);
      }

      // Then, merge with environment variables (env takes precedence)
      const envConfig = this.getEnvConfig();
      if (envConfig) {
        config = { ...config, ...envConfig };
      }

      // If no config at all, return null
      if (Object.keys(config).length === 0) {
        return null;
      }

      // Expand target directory path if it exists
      if (config.targetDir && config.targetDir.startsWith("~")) {
        config.targetDir = config.targetDir.replace("~", os.homedir());
        config.targetDir = path.resolve(config.targetDir);
      } else if (config.targetDir) {
        config.targetDir = path.resolve(config.targetDir);
      }

      // Validate required fields
      if (!config.token) {
        throw new Error("Invalid configuration: GitHub token is missing");
      }

      return config;
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  async exists() {
    return await fs.pathExists(this.configFile);
  }

  async remove() {
    try {
      if (await fs.pathExists(this.configFile)) {
        await fs.remove(this.configFile);
        console.log(chalk.yellow("Configuration removed"));
      }
    } catch (error) {
      throw new Error(`Failed to remove configuration: ${error.message}`);
    }
  }

  getConfigPath() {
    return this.configFile;
  }
}
