import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";

export class RepositoryOrganizer {
  constructor(cloneHome) {
    this.cloneHome = cloneHome;
    this.repositories = [];
    this.directoryTree = {};
  }

  async organize() {
    console.log(chalk.blue("🗂️  Repository Organizer"));
    console.log(chalk.dim("Organize your repositories into custom directory structures\n"));

    // Fetch all repositories
    this.repositories = await this.cloneHome.getAllRepositories();

    const action = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "📋 Browse and categorize repositories", value: "browse" },
          { name: "🌳 Create directory tree configuration", value: "tree" },
          { name: "📁 Auto-organize by language/topic", value: "auto" },
          { name: "💾 Save current organization", value: "save" },
          { name: "📤 Export repository list", value: "export" },
        ],
      },
    ]);

    switch (action.action) {
      case "browse":
        await this.browseRepositories();
        break;
      case "tree":
        await this.createDirectoryTree();
        break;
      case "auto":
        await this.autoOrganize();
        break;
      case "save":
        await this.saveOrganization();
        break;
      case "export":
        await this.exportRepositoryList();
        break;
    }
  }

  async browseRepositories() {
    console.log(chalk.blue("\n📋 Repository Browser\n"));

    let currentPage = 0;
    const pageSize = 10;
    const totalPages = Math.ceil(this.repositories.length / pageSize);

    while (true) {
      const startIdx = currentPage * pageSize;
      const endIdx = Math.min(startIdx + pageSize, this.repositories.length);
      const pageRepos = this.repositories.slice(startIdx, endIdx);

      console.clear();
      console.log(chalk.blue(`📋 Repository Browser (Page ${currentPage + 1}/${totalPages})\n`));

      // Display repositories on current page
      pageRepos.forEach((repo, index) => {
        const globalIndex = startIdx + index;
        const status = repo.private ? chalk.yellow("🔒") : chalk.green("🌍");
        const fork = repo.fork ? chalk.dim(" (fork)") : "";
        const language = repo.language ? chalk.cyan(`[${repo.language}]`) : chalk.dim("[No language]");

        console.log(
          `${chalk.dim((globalIndex + 1).toString().padStart(3))}. ${status} ${chalk.white(
            repo.full_name
          )}${fork} ${language}`
        );
        console.log(`     ${chalk.dim(repo.description || "No description")}`);
        console.log(`     ${chalk.dim(`Updated: ${new Date(repo.updated_at).toLocaleDateString()}`)}`);
        console.log();
      });

      const choices = [
        { name: "📁 Assign directory for selected repos", value: "assign" },
        { name: "🔍 Filter repositories", value: "filter" },
        { name: "📊 Show repository stats", value: "stats" },
      ];

      if (currentPage > 0) choices.push({ name: "⬅️  Previous page", value: "prev" });
      if (currentPage < totalPages - 1) choices.push({ name: "➡️  Next page", value: "next" });
      choices.push({ name: "🔙 Back to main menu", value: "back" });

      const action = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices,
        },
      ]);

      switch (action.action) {
        case "assign":
          await this.assignDirectory(pageRepos, startIdx);
          break;
        case "filter":
          await this.filterRepositories();
          return;
        case "stats":
          await this.showRepositoryStats();
          break;
        case "prev":
          currentPage--;
          break;
        case "next":
          currentPage++;
          break;
        case "back":
          return;
      }
    }
  }

  async assignDirectory(pageRepos, startIdx) {
    const repoChoices = pageRepos.map((repo, index) => ({
      name: `${repo.full_name} ${repo.private ? "🔒" : "🌍"}`,
      value: startIdx + index,
      checked: false,
    }));

    const selected = await inquirer.prompt([
      {
        type: "checkbox",
        name: "repos",
        message: "Select repositories to assign to a directory:",
        choices: repoChoices,
      },
    ]);

    if (selected.repos.length === 0) {
      console.log(chalk.yellow("No repositories selected."));
      return;
    }

    const directory = await inquirer.prompt([
      {
        type: "input",
        name: "path",
        message: 'Enter directory path (e.g., "projects/web", "work/clients"):',
        validate: (input) => input.trim().length > 0 || "Directory path is required",
      },
    ]);

    // Store the assignments
    selected.repos.forEach((repoIndex) => {
      const repo = this.repositories[repoIndex];
      if (!this.directoryTree[directory.path]) {
        this.directoryTree[directory.path] = [];
      }
      this.directoryTree[directory.path].push(repo.full_name);
    });

    console.log(chalk.green(`✅ Assigned ${selected.repos.length} repositories to "${directory.path}"`));
    await this.pause();
  }

  async filterRepositories() {
    const filter = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Filter by:",
        choices: [
          { name: "Language", value: "language" },
          { name: "Owner", value: "owner" },
          { name: "Name pattern", value: "name" },
          { name: "Private/Public", value: "visibility" },
          { name: "Fork status", value: "fork" },
        ],
      },
    ]);

    let filteredRepos = [];

    switch (filter.type) {
      case "language":
        const languages = [...new Set(this.repositories.map((r) => r.language).filter(Boolean))].sort();
        const langChoice = await inquirer.prompt([
          {
            type: "list",
            name: "language",
            message: "Select language:",
            choices: languages,
          },
        ]);
        filteredRepos = this.repositories.filter((r) => r.language === langChoice.language);
        break;

      case "owner":
        const owners = [...new Set(this.repositories.map((r) => r.owner.login))].sort();
        const ownerChoice = await inquirer.prompt([
          {
            type: "list",
            name: "owner",
            message: "Select owner:",
            choices: owners,
          },
        ]);
        filteredRepos = this.repositories.filter((r) => r.owner.login === ownerChoice.owner);
        break;

      case "name":
        const pattern = await inquirer.prompt([
          {
            type: "input",
            name: "pattern",
            message: "Enter name pattern (regex):",
            validate: (input) => input.trim().length > 0 || "Pattern is required",
          },
        ]);
        const regex = new RegExp(pattern.pattern, "i");
        filteredRepos = this.repositories.filter((r) => regex.test(r.name));
        break;

      case "visibility":
        const visibility = await inquirer.prompt([
          {
            type: "list",
            name: "visibility",
            message: "Select visibility:",
            choices: ["Private", "Public"],
          },
        ]);
        filteredRepos = this.repositories.filter((r) => (visibility.visibility === "Private" ? r.private : !r.private));
        break;

      case "fork":
        const forkStatus = await inquirer.prompt([
          {
            type: "list",
            name: "fork",
            message: "Select fork status:",
            choices: ["Forks only", "Original repos only"],
          },
        ]);
        filteredRepos = this.repositories.filter((r) => (forkStatus.fork === "Forks only" ? r.fork : !r.fork));
        break;
    }

    console.log(chalk.blue(`\n🔍 Filtered to ${filteredRepos.length} repositories:\n`));

    filteredRepos.forEach((repo, index) => {
      const status = repo.private ? chalk.yellow("🔒") : chalk.green("🌍");
      const fork = repo.fork ? chalk.dim(" (fork)") : "";
      const language = repo.language ? chalk.cyan(`[${repo.language}]`) : "";

      console.log(
        `${chalk.dim((index + 1).toString().padStart(3))}. ${status} ${chalk.white(repo.full_name)}${fork} ${language}`
      );
    });

    await this.pause();
  }

  async pause() {
    await inquirer.prompt([
      {
        type: "input",
        name: "continue",
        message: "Press Enter to continue...",
      },
    ]);
  }

  async createDirectoryTree() {
    console.log(chalk.blue("\n🌳 Directory Tree Configuration\n"));

    const treeConfig = {
      rules: [],
      customPaths: {},
    };

    while (true) {
      const action = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "Configure directory structure:",
          choices: [
            { name: "📁 Add directory rule", value: "rule" },
            { name: "🎯 Set custom path for specific repo", value: "custom" },
            { name: "👀 Preview directory structure", value: "preview" },
            { name: "💾 Save configuration", value: "save" },
            { name: "🔙 Back to main menu", value: "back" },
          ],
        },
      ]);

      switch (action.action) {
        case "rule":
          await this.addDirectoryRule(treeConfig);
          break;
        case "custom":
          await this.addCustomPath(treeConfig);
          break;
        case "preview":
          await this.previewDirectoryStructure(treeConfig);
          break;
        case "save":
          await this.saveDirectoryTreeConfig(treeConfig);
          return;
        case "back":
          return;
      }
    }
  }

  async addDirectoryRule(treeConfig) {
    const rule = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Rule type:",
        choices: [
          { name: "By language", value: "language" },
          { name: "By owner", value: "owner" },
          { name: "By repository name pattern", value: "pattern" },
          { name: "By fork status", value: "fork" },
          { name: "By visibility", value: "visibility" },
        ],
      },
      {
        type: "input",
        name: "value",
        message: 'Rule value (e.g., "javascript", "myorg", ".*-api$"):',
        validate: (input) => input.trim().length > 0 || "Value is required",
      },
      {
        type: "input",
        name: "directory",
        message: 'Target directory (e.g., "languages/javascript", "organizations/myorg"):',
        validate: (input) => input.trim().length > 0 || "Directory is required",
      },
    ]);

    treeConfig.rules.push(rule);
    console.log(chalk.green(`✅ Added rule: ${rule.type} "${rule.value}" → "${rule.directory}"`));
  }

  async addCustomPath(treeConfig) {
    // Show repositories to choose from
    const repoChoices = this.repositories.map((repo) => ({
      name: `${repo.full_name} ${repo.private ? "🔒" : "🌍"}`,
      value: repo.full_name,
    }));

    const selection = await inquirer.prompt([
      {
        type: "list",
        name: "repo",
        message: "Select repository:",
        choices: repoChoices,
        pageSize: 15,
      },
      {
        type: "input",
        name: "path",
        message: "Custom directory path:",
        validate: (input) => input.trim().length > 0 || "Path is required",
      },
    ]);

    treeConfig.customPaths[selection.repo] = selection.path;
    console.log(chalk.green(`✅ Set custom path: ${selection.repo} → "${selection.path}"`));
  }

  async previewDirectoryStructure(treeConfig) {
    console.log(chalk.blue("\n🌳 Directory Structure Preview\n"));

    const structure = {};

    // Apply rules to repositories
    this.repositories.forEach((repo) => {
      let targetDir = null;

      // Check custom paths first
      if (treeConfig.customPaths[repo.full_name]) {
        targetDir = treeConfig.customPaths[repo.full_name];
      } else {
        // Apply rules in order
        for (const rule of treeConfig.rules) {
          if (this.matchesRule(repo, rule)) {
            targetDir = rule.directory;
            break;
          }
        }
      }

      // Default to owner/repo structure
      if (!targetDir) {
        targetDir = repo.owner.login;
      }

      if (!structure[targetDir]) {
        structure[targetDir] = [];
      }
      structure[targetDir].push(repo.full_name);
    });

    // Display structure
    Object.keys(structure)
      .sort()
      .forEach((dir) => {
        console.log(chalk.cyan(`📁 ${dir}/`));
        structure[dir].forEach((repo) => {
          console.log(chalk.dim(`   └── ${repo}`));
        });
        console.log();
      });

    await this.pause();
  }

  matchesRule(repo, rule) {
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

  async saveDirectoryTreeConfig(treeConfig) {
    const configPath = path.join(process.cwd(), "directory-tree.json");
    await fs.writeJson(configPath, treeConfig, { spaces: 2 });
    console.log(chalk.green(`✅ Directory tree configuration saved to ${configPath}`));
  }

  async autoOrganize() {
    console.log(chalk.blue("\n📁 Auto-Organization\n"));

    const method = await inquirer.prompt([
      {
        type: "list",
        name: "method",
        message: "Auto-organize by:",
        choices: [
          { name: "🔤 Programming Language", value: "language" },
          { name: "👤 Repository Owner", value: "owner" },
          { name: "🏢 Organization vs Personal", value: "org-type" },
          { name: "🍴 Fork Status", value: "fork-status" },
          { name: "🔒 Visibility (Public/Private)", value: "visibility" },
          { name: "📅 Last Updated (by year)", value: "year" },
        ],
      },
    ]);

    const organization = this.generateAutoOrganization(method.method);

    console.log(chalk.blue("\n🌳 Auto-Generated Organization:\n"));

    Object.keys(organization)
      .sort()
      .forEach((dir) => {
        console.log(chalk.cyan(`📁 ${dir}/ (${organization[dir].length} repos)`));
        organization[dir].slice(0, 5).forEach((repo) => {
          console.log(chalk.dim(`   └── ${repo}`));
        });
        if (organization[dir].length > 5) {
          console.log(chalk.dim(`   └── ... and ${organization[dir].length - 5} more`));
        }
        console.log();
      });

    const confirm = await inquirer.prompt([
      {
        type: "confirm",
        name: "apply",
        message: "Apply this organization?",
        default: false,
      },
    ]);

    if (confirm.apply) {
      this.directoryTree = organization;
      console.log(chalk.green("✅ Auto-organization applied!"));
    }
  }

  generateAutoOrganization(method) {
    const organization = {};

    this.repositories.forEach((repo) => {
      let category;

      switch (method) {
        case "language":
          category = `languages/${repo.language || "unknown"}`;
          break;
        case "owner":
          category = `owners/${repo.owner.login}`;
          break;
        case "org-type":
          category = repo.owner.type === "Organization" ? "organizations" : "personal";
          break;
        case "fork-status":
          category = repo.fork ? "forks" : "original";
          break;
        case "visibility":
          category = repo.private ? "private" : "public";
          break;
        case "year":
          const year = new Date(repo.updated_at).getFullYear();
          category = `by-year/${year}`;
          break;
        default:
          category = "uncategorized";
      }

      if (!organization[category]) {
        organization[category] = [];
      }
      organization[category].push(repo.full_name);
    });

    return organization;
  }

  async saveOrganization() {
    if (Object.keys(this.directoryTree).length === 0) {
      console.log(chalk.yellow("No organization to save. Please organize repositories first."));
      return;
    }

    const configPath = path.join(process.cwd(), "repository-organization.json");
    await fs.writeJson(configPath, this.directoryTree, { spaces: 2 });
    console.log(chalk.green(`✅ Repository organization saved to ${configPath}`));
  }

  async exportRepositoryList() {
    const format = await inquirer.prompt([
      {
        type: "list",
        name: "format",
        message: "Export format:",
        choices: [
          { name: "JSON (detailed)", value: "json" },
          { name: "CSV (spreadsheet)", value: "csv" },
          { name: "Markdown (documentation)", value: "markdown" },
          { name: "Text (simple list)", value: "text" },
        ],
      },
    ]);

    const timestamp = new Date().toISOString().split("T")[0];
    let filename, content;

    switch (format.format) {
      case "json":
        filename = `repositories-${timestamp}.json`;
        content = JSON.stringify(this.repositories, null, 2);
        break;
      case "csv":
        filename = `repositories-${timestamp}.csv`;
        content = this.generateCSV();
        break;
      case "markdown":
        filename = `repositories-${timestamp}.md`;
        content = this.generateMarkdown();
        break;
      case "text":
        filename = `repositories-${timestamp}.txt`;
        content = this.repositories.map((r) => r.full_name).join("\n");
        break;
    }

    await fs.writeFile(filename, content);
    console.log(chalk.green(`✅ Repository list exported to ${filename}`));
  }

  generateCSV() {
    const headers = "Name,Owner,Private,Fork,Language,Description,Updated,URL\n";
    const rows = this.repositories
      .map((repo) => {
        const fields = [
          repo.name,
          repo.owner.login,
          repo.private,
          repo.fork,
          repo.language || "",
          (repo.description || "").replace(/"/g, '""'),
          repo.updated_at,
          repo.html_url,
        ];
        return fields.map((field) => `"${field}"`).join(",");
      })
      .join("\n");

    return headers + rows;
  }

  generateMarkdown() {
    let content = `# My GitHub Repositories\n\nGenerated on ${new Date().toLocaleDateString()}\n\n`;
    content += `Total repositories: ${this.repositories.length}\n\n`;

    // Group by owner
    const byOwner = {};
    this.repositories.forEach((repo) => {
      if (!byOwner[repo.owner.login]) {
        byOwner[repo.owner.login] = [];
      }
      byOwner[repo.owner.login].push(repo);
    });

    Object.keys(byOwner)
      .sort()
      .forEach((owner) => {
        content += `## ${owner}\n\n`;
        byOwner[owner].forEach((repo) => {
          const status = repo.private ? "🔒" : "🌍";
          const fork = repo.fork ? " (fork)" : "";
          const language = repo.language ? ` \`${repo.language}\`` : "";

          content += `- ${status} [${repo.name}](${repo.html_url})${fork}${language}\n`;
          if (repo.description) {
            content += `  ${repo.description}\n`;
          }
          content += "\n";
        });
      });

    return content;
  }

  async showRepositoryStats() {
    console.log(chalk.blue("\n📊 Repository Statistics\n"));

    const stats = {
      total: this.repositories.length,
      private: this.repositories.filter((r) => r.private).length,
      public: this.repositories.filter((r) => !r.private).length,
      forks: this.repositories.filter((r) => r.fork).length,
      original: this.repositories.filter((r) => !r.fork).length,
      languages: {},
      owners: {},
    };

    // Count languages
    this.repositories.forEach((repo) => {
      const lang = repo.language || "Unknown";
      stats.languages[lang] = (stats.languages[lang] || 0) + 1;

      const owner = repo.owner.login;
      stats.owners[owner] = (stats.owners[owner] || 0) + 1;
    });

    console.log(chalk.cyan("📈 Overview:"));
    console.log(`   Total repositories: ${stats.total}`);
    console.log(`   Public: ${stats.public} | Private: ${stats.private}`);
    console.log(`   Original: ${stats.original} | Forks: ${stats.forks}`);
    console.log();

    console.log(chalk.cyan("🔤 Top Languages:"));
    Object.entries(stats.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([lang, count]) => {
        console.log(`   ${lang}: ${count}`);
      });
    console.log();

    console.log(chalk.cyan("👤 Top Owners:"));
    Object.entries(stats.owners)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([owner, count]) => {
        console.log(`   ${owner}: ${count}`);
      });

    await this.pause();
  }
}
