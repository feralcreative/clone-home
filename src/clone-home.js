import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import ora from "ora";

export class CloneHome {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
    this.git = simpleGit();
  }

  async getAllRepositories(options = {}) {
    const spinner = ora("Fetching repositories from GitHub...").start();

    try {
      const repositories = [];

      // Get user's own repositories
      const userRepos = await this.octokit.paginate(this.octokit.rest.repos.listForAuthenticatedUser, {
        visibility: "all",
        sort: "updated",
        per_page: 100,
      });

      repositories.push(...userRepos);

      // Get organization repositories if enabled
      if (this.config.includeOrgs) {
        const orgs = await this.octokit.rest.orgs.listForAuthenticatedUser();

        for (const org of orgs.data) {
          const orgRepos = await this.octokit.paginate(this.octokit.rest.repos.listForOrg, {
            org: org.login,
            type: "all",
            sort: "updated",
            per_page: 100,
          });
          repositories.push(...orgRepos);
        }
      }

      // Filter repositories
      let filteredRepos = repositories;

      // Remove forks if not included
      if (!this.config.includeForks) {
        filteredRepos = filteredRepos.filter((repo) => !repo.fork);
      }

      // Apply name filter if provided
      if (options.filter) {
        const pattern = new RegExp(options.filter, "i");
        filteredRepos = filteredRepos.filter((repo) => pattern.test(repo.name));
      }

      // Remove duplicates (can happen with org repos)
      const uniqueRepos = filteredRepos.reduce((acc, repo) => {
        if (!acc.find((r) => r.full_name === repo.full_name)) {
          acc.push(repo);
        }
        return acc;
      }, []);

      spinner.succeed(`Found ${uniqueRepos.length} repositories`);
      return uniqueRepos;
    } catch (error) {
      spinner.fail("Failed to fetch repositories");
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }

  async listRepositories(options = {}) {
    const repositories = await this.getAllRepositories(options);

    console.log(chalk.blue(`\n📋 Found ${repositories.length} repositories:\n`));

    repositories.forEach((repo, index) => {
      const status = repo.private ? chalk.yellow("🔒 private") : chalk.green("🌍 public");
      const fork = repo.fork ? chalk.dim(" (fork)") : "";
      const updated = new Date(repo.updated_at).toLocaleDateString();

      console.log(`${chalk.dim((index + 1).toString().padStart(3))}. ${chalk.white(repo.full_name)} ${status}${fork}`);
      console.log(`     ${chalk.dim(`Updated: ${updated} | ${repo.description || "No description"}`)}`);
    });
  }

  async cloneRepository(repo, targetPath, options = {}) {
    // Determine the repository path based on directory tree config
    const repoPath = await this.getRepositoryPath(repo, targetPath);

    // Check if repository already exists
    if (await fs.pathExists(repoPath)) {
      if (!options.force) {
        return { status: "exists", path: repoPath };
      }

      // Remove existing directory if force is enabled
      await fs.remove(repoPath);
    }

    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(repoPath));

    try {
      // Clone the repository
      await this.git.clone(repo.clone_url, repoPath, ["--quiet"]);
      return { status: "cloned", path: repoPath };
    } catch (error) {
      return { status: "error", path: repoPath, error: error.message };
    }
  }

  async getRepositoryPath(repo, basePath) {
    // Check for directory tree configuration
    const treeConfigPath = path.join(process.cwd(), "directory-tree.json");
    const orgConfigPath = path.join(process.cwd(), "repository-organization.json");

    let customPath = null;

    // Try to load directory tree configuration first
    if (await fs.pathExists(treeConfigPath)) {
      try {
        const treeConfig = await fs.readJson(treeConfigPath);
        customPath = this.applyDirectoryTreeRules(repo, treeConfig);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not load directory tree config: ${error.message}`));
      }
    }

    // Try repository organization configuration
    if (!customPath && (await fs.pathExists(orgConfigPath))) {
      try {
        const orgConfig = await fs.readJson(orgConfigPath);
        customPath = this.findRepositoryInOrganization(repo, orgConfig);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not load organization config: ${error.message}`));
      }
    }

    // Use custom path if found, otherwise default to owner/repo structure
    if (customPath) {
      return path.join(basePath, customPath, repo.name);
    } else {
      return path.join(basePath, repo.owner.login, repo.name);
    }
  }

  applyDirectoryTreeRules(repo, treeConfig) {
    // Check custom paths first
    if (treeConfig.customPaths && treeConfig.customPaths[repo.full_name]) {
      return treeConfig.customPaths[repo.full_name];
    }

    // Apply rules in order
    if (treeConfig.rules) {
      for (const rule of treeConfig.rules) {
        if (this.matchesDirectoryRule(repo, rule)) {
          return rule.directory;
        }
      }
    }

    return null;
  }

  matchesDirectoryRule(repo, rule) {
    switch (rule.type) {
      case "language":
        return repo.language && repo.language.toLowerCase() === rule.value.toLowerCase();
      case "owner":
        return repo.owner.login === rule.value;
      case "pattern":
        const regex = new RegExp(rule.value, "i");
        return regex.test(repo.name);
      case "fork":
        return rule.value === "true" ? repo.fork : !repo.fork;
      case "visibility":
        return rule.value === "private" ? repo.private : !repo.private;
      default:
        return false;
    }
  }

  findRepositoryInOrganization(repo, orgConfig) {
    for (const [directory, repositories] of Object.entries(orgConfig)) {
      if (repositories.includes(repo.full_name)) {
        return directory;
      }
    }
    return null;
  }

  async cloneAll(options = {}) {
    const repositories = await this.getAllRepositories(options);

    if (options.dryRun) {
      console.log(chalk.yellow("\n🔍 Dry run - showing what would be cloned:\n"));
      await this.listRepositories(options);
      return;
    }

    console.log(chalk.blue(`\n🚀 Starting to clone ${repositories.length} repositories...\n`));

    const results = {
      cloned: [],
      exists: [],
      errors: [],
    };

    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      const spinner = ora(`[${i + 1}/${repositories.length}] Cloning ${repo.full_name}...`).start();

      try {
        const result = await this.cloneRepository(repo, this.config.targetDir, options);

        switch (result.status) {
          case "cloned":
            spinner.succeed(`Cloned ${repo.full_name}`);
            results.cloned.push(repo.full_name);
            break;
          case "exists":
            spinner.info(`Already exists: ${repo.full_name}`);
            results.exists.push(repo.full_name);
            break;
          case "error":
            spinner.fail(`Failed to clone ${repo.full_name}: ${result.error}`);
            results.errors.push({ repo: repo.full_name, error: result.error });
            break;
        }
      } catch (error) {
        spinner.fail(`Error cloning ${repo.full_name}: ${error.message}`);
        results.errors.push({ repo: repo.full_name, error: error.message });
      }
    }

    // Print summary
    console.log(chalk.blue("\n📊 Clone Summary:"));
    console.log(chalk.green(`✅ Cloned: ${results.cloned.length}`));
    console.log(chalk.yellow(`ℹ️  Already existed: ${results.exists.length}`));
    console.log(chalk.red(`❌ Errors: ${results.errors.length}`));

    if (results.errors.length > 0) {
      console.log(chalk.red("\n❌ Errors encountered:"));
      results.errors.forEach((error) => {
        console.log(chalk.red(`  • ${error.repo}: ${error.error}`));
      });
    }
  }

  async showStatus() {
    console.log(chalk.blue("📊 Repository Status\n"));

    const targetDir = this.config.targetDir;

    if (!(await fs.pathExists(targetDir))) {
      console.log(chalk.yellow("Target directory does not exist yet."));
      return;
    }

    const spinner = ora("Scanning local repositories...").start();

    try {
      const localRepos = [];
      const owners = await fs.readdir(targetDir);

      for (const owner of owners) {
        const ownerPath = path.join(targetDir, owner);
        const stat = await fs.stat(ownerPath);

        if (stat.isDirectory()) {
          const repos = await fs.readdir(ownerPath);

          for (const repo of repos) {
            const repoPath = path.join(ownerPath, repo);
            const repoStat = await fs.stat(repoPath);

            if (repoStat.isDirectory()) {
              const gitPath = path.join(repoPath, ".git");
              if (await fs.pathExists(gitPath)) {
                localRepos.push({
                  name: `${owner}/${repo}`,
                  path: repoPath,
                  lastModified: repoStat.mtime,
                });
              }
            }
          }
        }
      }

      spinner.succeed(`Found ${localRepos.length} local repositories`);

      if (localRepos.length === 0) {
        console.log(chalk.yellow("No repositories found locally."));
        return;
      }

      // Sort by last modified
      localRepos.sort((a, b) => b.lastModified - a.lastModified);

      console.log(chalk.blue("\n📁 Local Repositories:\n"));

      localRepos.forEach((repo, index) => {
        const lastModified = repo.lastModified.toLocaleDateString();
        console.log(`${chalk.dim((index + 1).toString().padStart(3))}. ${chalk.white(repo.name)}`);
        console.log(`     ${chalk.dim(`Path: ${repo.path}`)}`);
        console.log(`     ${chalk.dim(`Last modified: ${lastModified}`)}`);
      });
    } catch (error) {
      spinner.fail("Failed to scan local repositories");
      throw new Error(`Status check error: ${error.message}`);
    }
  }
}
