import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { Config } from "../src/config.js";

// Create a test-specific config class that doesn't load .env
class TestConfig extends Config {
  loadEnvFile() {
    // Override to do nothing - don't load .env file during tests
  }
}

describe("Config", () => {
  let config;
  let testConfigDir;
  let originalEnv;

  // Save original environment variables before tests
  test("setup", () => {
    originalEnv = {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      TARGET_DIR: process.env.TARGET_DIR,
      INCLUDE_ORGS: process.env.INCLUDE_ORGS,
      INCLUDE_FORKS: process.env.INCLUDE_FORKS,
    };

    // Clear environment variables for testing
    delete process.env.GITHUB_TOKEN;
    delete process.env.TARGET_DIR;
    delete process.env.INCLUDE_ORGS;
    delete process.env.INCLUDE_FORKS;
  });

  // Restore environment variables after tests
  test("teardown", () => {
    if (originalEnv.GITHUB_TOKEN) process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN;
    if (originalEnv.TARGET_DIR) process.env.TARGET_DIR = originalEnv.TARGET_DIR;
    if (originalEnv.INCLUDE_ORGS) process.env.INCLUDE_ORGS = originalEnv.INCLUDE_ORGS;
    if (originalEnv.INCLUDE_FORKS) process.env.INCLUDE_FORKS = originalEnv.INCLUDE_FORKS;
  });

  test("should create config instance", () => {
    config = new TestConfig();
    assert.ok(config instanceof Config);
  });

  test("should save and load configuration", async () => {
    // Create a temporary config directory for testing
    testConfigDir = path.join(os.tmpdir(), "clone-home-test-" + Date.now());
    config.configDir = testConfigDir;
    config.configFile = path.join(testConfigDir, "config.json");

    const testConfig = {
      token: "test-token",
      targetDir: "./test-repos",
      includeOrgs: true,
      includeForks: false,
    };

    // Save configuration
    await config.save(testConfig);

    // Verify file exists
    assert.ok(await fs.pathExists(config.configFile));

    // Load configuration
    const loadedConfig = await config.load();

    assert.strictEqual(loadedConfig.token, testConfig.token);
    assert.strictEqual(loadedConfig.includeOrgs, testConfig.includeOrgs);
    assert.strictEqual(loadedConfig.includeForks, testConfig.includeForks);

    // Clean up
    await fs.remove(testConfigDir);
  });

  test("should return null when config does not exist", async () => {
    const nonExistentConfig = new TestConfig();
    nonExistentConfig.configFile = path.join(os.tmpdir(), "non-existent-config.json");

    const result = await nonExistentConfig.load();
    assert.strictEqual(result, null);
  });

  test("should throw error when saving config without token", async () => {
    const invalidConfig = {
      targetDir: "./test-repos",
      // missing token
    };

    await assert.rejects(async () => await config.save(invalidConfig), /GitHub token is required/);
  });
});
