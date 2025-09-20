#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { CloneHome } from "./clone-home.js";
import { Config } from "./config.js";
import { RepositoryOrganizer } from "./organizer.js";
import { WebUI } from "./web-ui.js";

const program = new Command();

program
  .name("clone-home")
  .description("Clone all your GitHub repositories to set up a development machine")
  .version("1.0.0");

program
  .command("setup")
  .description("Initial setup - configure GitHub token and preferences")
  .action(async () => {
    console.log(chalk.blue("🏠 Welcome to Clone Home Setup"));

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "token",
        message: "Enter your GitHub Personal Access Token:",
        validate: (input) => input.length > 0 || "Token is required",
      },
      {
        type: "input",
        name: "targetDir",
        message: "Enter target directory for repositories:",
        default: "./repositories",
      },
      {
        type: "confirm",
        name: "includeOrgs",
        message: "Include organization repositories?",
        default: true,
      },
      {
        type: "confirm",
        name: "includeForks",
        message: "Include forked repositories?",
        default: false,
      },
    ]);

    const config = new Config();
    await config.save(answers);

    console.log(chalk.green("✅ Configuration saved!"));
    console.log(chalk.yellow('Run "clone-home clone" to start cloning repositories.'));
  });

program
  .command("clone")
  .description("Clone all repositories")
  .option("-d, --dry-run", "Show what would be cloned without actually cloning")
  .option("-f, --force", "Force clone even if directory exists")
  .option("--filter <pattern>", "Filter repositories by name pattern")
  .action(async (options) => {
    try {
      const config = new Config();
      const settings = await config.load();

      if (!settings) {
        console.log(chalk.red('❌ No configuration found. Run "clone-home setup" first.'));
        return;
      }

      const cloneHome = new CloneHome(settings);
      await cloneHome.cloneAll(options);
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all repositories that would be cloned")
  .option("--filter <pattern>", "Filter repositories by name pattern")
  .action(async (options) => {
    try {
      const config = new Config();
      const settings = await config.load();

      if (!settings) {
        console.log(chalk.red('❌ No configuration found. Run "clone-home setup" first.'));
        return;
      }

      const cloneHome = new CloneHome(settings);
      await cloneHome.listRepositories(options);
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show status of cloned repositories")
  .action(async () => {
    try {
      const config = new Config();
      const settings = await config.load();

      if (!settings) {
        console.log(chalk.red('❌ No configuration found. Run "clone-home setup" first.'));
        return;
      }

      const cloneHome = new CloneHome(settings);
      await cloneHome.showStatus();
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("organize")
  .description("Interactive repository organization and directory tree configuration")
  .action(async () => {
    try {
      const config = new Config();
      const settings = await config.load();

      if (!settings) {
        console.log(chalk.red('❌ No configuration found. Run "clone-home setup" first.'));
        return;
      }

      const cloneHome = new CloneHome(settings);
      const organizer = new RepositoryOrganizer(cloneHome);
      await organizer.organize();
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("web")
  .description("Launch web interface for repository management")
  .option("-p, --port <port>", "Port to run web server on", "3847")
  .action(async (options) => {
    try {
      const webUI = new WebUI();
      webUI.port = parseInt(options.port);
      await webUI.start();

      console.log(chalk.green("🌐 Web interface started!"));
      console.log(chalk.blue(`   Open your browser to: http://localhost:${webUI.port}`));
      console.log(chalk.dim("   Press Ctrl+C to stop the server"));

      // Keep the process running
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n👋 Shutting down web server..."));
        webUI.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program.parse();
