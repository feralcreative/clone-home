let repositories = [];
let filteredRepositories = [];
let organizationConfig = {};
let draggedRepo = null;
let selectedRepos = new Set();
let envStatusEventSource = null;

// Terminal-related variables
let terminalVisible = false;
let currentSessionId = null;
let cloneResults = [];
let eventSource = null;
let cloneStartTime = null;

// Helper function to format date as YYYY-MM-DD
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

// Debounce function to improve performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Tab Management
const tabOrder = ["setup", "repositories", "organize", "clone"];
let currentTabIndex = 0;

// Initialize tab from URL hash
function initializeTabFromHash() {
  const hash = window.location.hash.substring(1); // Remove the # symbol

  if (hash && tabOrder.includes(hash)) {
    showTab(hash, true); // Skip validation on initial load
  } else {
    // Default to first tab if no valid hash
    showTab(tabOrder[0], true);
  }
}

// Listen for hash changes (back/forward browser navigation)
window.addEventListener("hashchange", function () {
  const hash = window.location.hash.substring(1);
  if (hash && tabOrder.includes(hash)) {
    showTab(hash, true);
  }
});

function showTab(tabName, skipValidation = false) {
  // Update current tab index
  currentTabIndex = tabOrder.indexOf(tabName);

  // Hide all tab contents
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Remove active class from all tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Show selected tab content
  document.getElementById(tabName).classList.add("active");

  // Add active class to corresponding tab button
  const tabButtons = document.querySelectorAll(".tab");
  if (tabButtons[currentTabIndex]) {
    tabButtons[currentTabIndex].classList.add("active");
  }

  // Load data when switching to certain tabs
  if (tabName === "repositories" && repositories.length === 0) {
    loadRepositories();
  } else if (tabName === "organize") {
    if (repositories.length === 0) {
      loadRepositories().then(() => {
        loadOrganizationConfig().then(() => {
          initializeOrganizer();
          loadStats();
        });
      });
    } else {
      loadOrganizationConfig().then(() => {
        initializeOrganizer();
        loadStats();
      });
    }
  } else if (tabName === "clone") {
    checkOrganizationStatus();
  }

  // Update URL hash to remember the current tab
  if (history.replaceState) {
    history.replaceState(null, null, `#${tabName}`);
  } else {
    window.location.hash = tabName;
  }
}

// Check organization status and show notice if needed
async function checkOrganizationStatus() {
  try {
    const response = await fetch("/api/organization");
    const data = await response.json();

    const notice = document.getElementById("organization-notice");
    if (notice) {
      // Show notice if no custom organization is set up
      const hasCustomOrganization = Object.keys(data.organization).length > 0;
      if (hasCustomOrganization) {
        notice.classList.add("hidden");
      } else {
        notice.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error("Error checking organization status:", error);
  }
}

function nextTab() {
  if (currentTabIndex < tabOrder.length - 1) {
    const nextTabName = tabOrder[currentTabIndex + 1];

    // Validate current tab before proceeding
    if (validateCurrentTab()) {
      showTab(nextTabName, true);
    }
  }
}

function previousTab() {
  if (currentTabIndex > 0) {
    const previousTabName = tabOrder[currentTabIndex - 1];
    showTab(previousTabName, true);
  }
}

function validateCurrentTab() {
  const currentTab = tabOrder[currentTabIndex];

  switch (currentTab) {
    case "setup":
      // Check if configuration is saved
      const token = document.getElementById("token").value;
      const targetDir = document.getElementById("targetDir").value;

      if (!token && !targetDir) {
        showError("Please configure your GitHub token and target directory before proceeding.");
        return false;
      }
      return true;

    case "repositories":
      // Check if repositories are loaded
      if (repositories.length === 0) {
        showError("Please load repositories before proceeding.");
        return false;
      }
      return true;

    case "organize":
      // Organization is optional, always allow proceeding
      return true;

    default:
      return true;
  }
}

// Configuration
async function saveConfig() {
  const config = {
    token: document.getElementById("token").value,
    targetDir: document.getElementById("targetDir").value,
    includeOrgs: document.getElementById("includeOrgs").checked,
    includeForks: document.getElementById("includeForks").checked,
  };

  if (!config.token) {
    showError("GitHub token is required");
    return;
  }

  // Get the save button for immediate feedback
  const saveButton = document.querySelector('button[onclick="saveConfig()"]');
  const originalText = saveButton ? saveButton.textContent : null;

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="material-icons">hourglass_empty</span> Saving...';
  }

  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (response.ok) {
      showSuccess("Configuration saved successfully!");

      // Show success on button temporarily
      if (saveButton) {
        saveButton.innerHTML = '<span class="material-icons">check_circle</span> Saved!';
        setTimeout(() => {
          saveButton.innerHTML = originalText;
          saveButton.disabled = false;
        }, 2000);
      }

      // Clear repositories to force reload
      repositories = [];
    } else {
      showError(result.error);

      // Reset button on error
      if (saveButton) {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
      }
    }
  } catch (error) {
    showError("Failed to save configuration: " + error.message);

    // Reset button on error
    if (saveButton) {
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
    }
  }
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const result = await response.json();

    if (result.configured && result.settings) {
      // Load token (show masked value if exists)
      if (result.settings.token) {
        document.getElementById("token").value = result.settings.token;
      }

      document.getElementById("targetDir").value = result.settings.targetDir;
      document.getElementById("includeOrgs").checked = result.settings.includeOrgs;
      document.getElementById("includeForks").checked = result.settings.includeForks;
    }

    // Show environment variable indicators
    if (result.envConfig) {
      showEnvIndicators(result.envConfig);
    }
  } catch (error) {
    console.error("Failed to load config:", error);
  }
}

function showEnvIndicators(envConfig) {
  // GitHub Token indicator
  if (envConfig.hasToken) {
    const tokenInput = document.getElementById("token");
    const tokenIndicator = document.getElementById("token-env-indicator");

    tokenInput.classList.add("has-env-value"); // This will add the green border
    tokenInput.placeholder = "Override .env value or leave empty to use .env";
    tokenInput.value = ""; // Allow override
    tokenIndicator.classList.add("env-indicator-visible");
    tokenIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  }

  // Target Directory indicator
  if (envConfig.hasTargetDir) {
    const targetDirInput = document.getElementById("targetDir");
    const targetDirIndicator = document.getElementById("targetDir-env-indicator");

    targetDirInput.classList.add("has-env-value"); // This will add the green border
    targetDirIndicator.classList.add("env-indicator-visible");
    targetDirIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  }

  // Include Orgs indicator (if set via env)
  if (envConfig.hasIncludeOrgs) {
    const includeOrgsInput = document.getElementById("includeOrgs");
    const includeOrgsIndicator = document.getElementById("includeOrgs-env-indicator");

    includeOrgsInput.classList.add("has-env-value"); // This will add the green highlight
    includeOrgsIndicator.classList.add("env-indicator-visible");
    includeOrgsIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  }

  // Include Forks indicator (if set via env)
  if (envConfig.hasIncludeForks) {
    const includeForksInput = document.getElementById("includeForks");
    const includeForksIndicator = document.getElementById("includeForks-env-indicator");

    includeForksInput.classList.add("has-env-value"); // This will add the green highlight
    includeForksIndicator.classList.add("env-indicator-visible");
    includeForksIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  }
}

// Export configuration to .env file
function exportToEnv() {
  try {
    const token = document.getElementById("token").value.trim();
    const targetDir = document.getElementById("targetDir").value.trim();
    const includeOrgs = document.getElementById("includeOrgs").checked;
    const includeForks = document.getElementById("includeForks").checked;

    if (!token) {
      showError("GitHub token is required to export .env file");
      return;
    }

    if (!targetDir) {
      showError("Target directory is required to export .env file");
      return;
    }

    // Generate .env file content
    const envContent = `# GitHub Personal Access Token
# Create one at: https://github.com/settings/tokens
# Required scopes: repo, read:org
GITHUB_TOKEN=${token}

# Target directory for cloned repositories
TARGET_DIR=${targetDir}

# Include organization repositories (true/false)
INCLUDE_ORGS=${includeOrgs}

# Include forked repositories (true/false)
INCLUDE_FORKS=${includeForks}
`;

    // Create and download the file
    const blob = new Blob([envContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess("✓ .env file exported successfully! Place it in your Clone Home directory.");
  } catch (error) {
    console.error("Export error:", error);
    showError("Failed to export .env file: " + error.message);
  }
}

// Clear organization structure with confirmation
function clearOrganizationStructure() {
  const hasOrganizedRepos = Object.keys(organizationConfig).length > 0;

  if (!hasOrganizedRepos) {
    showError("No organized repositories to clear");
    return;
  }

  const confirmed = confirm(
    "Are you sure you want to clear all organized repositories?\n\n" +
      "This will move all repositories back to the unorganized list. " +
      "This action cannot be undone."
  );

  if (confirmed) {
    // Clear the organization config
    organizationConfig = {};

    // Update displays
    initializeOrganizer();

    // Save the cleared configuration
    saveOrganizationConfig();

    showSuccess("Organization structure cleared. All repositories moved to unorganized list.");
  }
}

// Repository Management
async function loadRepositories() {
  const repoList = document.getElementById("repo-list");
  repoList.innerHTML = '<div class="loading">Loading repositories...</div>';

  try {
    const response = await fetch("/api/repositories");
    const result = await response.json();

    if (response.ok) {
      repositories = result.repositories;
      filteredRepositories = [...repositories];
      displayRepositories();
      populateFilters();
    } else {
      repoList.innerHTML = `<div class="error">${result.error}</div>`;
    }
  } catch (error) {
    repoList.innerHTML = `<div class="error">Failed to load repositories: ${error.message}</div>`;
  }
}

function displayRepositories() {
  const repoList = document.getElementById("repo-list");

  if (filteredRepositories.length === 0) {
    repoList.innerHTML = '<div class="loading">No repositories found</div>';
    return;
  }

  const html = filteredRepositories
    .map(
      (repo) => `
        <div class="repo-item">
            <div class="repo-info">
                <h3>${repo.full_name}</h3>
                <p class="description">${repo.description || "No description"}</p>
                <div class="repo-meta">
                    <span class="badge ${repo.private ? "badge-private" : "badge-public"}">
                        ${
                          repo.private
                            ? '<span class="material-icons repo-icon-small" data-private="true">lock</span>Private'
                            : '<span class="material-icons repo-icon-small" data-private="false">public</span>Public'
                        }
                    </span>
                    ${repo.language ? `<span class="badge badge-language">${repo.language}</span>` : ""}
                    <span>Updated: ${formatDate(repo.updated_at)}</span>
                </div>
            </div>
        </div>
    `
    )
    .join("");

  repoList.innerHTML = html;
}

function populateFilters() {
  // Populate language filter
  const languages = [...new Set(repositories.map((r) => r.language).filter(Boolean))].sort();
  const languageFilter = document.getElementById("languageFilter");
  languageFilter.innerHTML =
    '<option value="">All Languages</option>' +
    languages.map((lang) => `<option value="${lang}">${lang}</option>`).join("");

  // Populate owner filter
  const owners = [...new Set(repositories.map((r) => r.owner.login))].sort();
  const ownerFilter = document.getElementById("ownerFilter");
  ownerFilter.innerHTML =
    '<option value="">All Owners</option>' +
    owners.map((owner) => `<option value="${owner}">${owner}</option>`).join("");
}

function filterRepositories() {
  const nameFilter = document.getElementById("repoFilter").value.toLowerCase();
  const languageFilter = document.getElementById("languageFilter").value;
  const ownerFilter = document.getElementById("ownerFilter").value;

  filteredRepositories = repositories.filter((repo) => {
    const matchesName =
      repo.full_name.toLowerCase().includes(nameFilter) ||
      (repo.description && repo.description.toLowerCase().includes(nameFilter));
    const matchesLanguage = !languageFilter || repo.language === languageFilter;
    const matchesOwner = !ownerFilter || repo.owner.login === ownerFilter;

    return matchesName && matchesLanguage && matchesOwner;
  });

  displayRepositories();
}

// Debounced version for better performance
const debouncedFilterRepositories = debounce(filterRepositories, 300);

// Statistics
async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const result = await response.json();

    if (response.ok) {
      displayStats(result.stats);
    } else {
      document.getElementById("stats-grid").innerHTML = `<div class="error">${result.error}</div>`;
    }
  } catch (error) {
    document.getElementById("stats-grid").innerHTML = `<div class="error">Failed to load stats: ${error.message}</div>`;
  }
}

function displayStats(stats) {
  // Overview stats
  const statsGrid = document.getElementById("stats-grid");
  statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.total}</div>
            <div class="stat-label">Total Repositories</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.private}</div>
            <div class="stat-label">Private</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.public}</div>
            <div class="stat-label">Public</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.forks}</div>
            <div class="stat-label">Forks</div>
        </div>
    `;

  // Detailed stats
  const topLanguages = Object.entries(stats.languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const topOwners = Object.entries(stats.owners)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const detailedStats = document.getElementById("detailed-stats");
  detailedStats.innerHTML = `
        <div class="stats-grid-layout">
            <div>
                <h3>Top Languages</h3>
                ${topLanguages
                  .map(
                    ([lang, count]) => `
                    <div class="stat-item">
                        <span>${lang}</span>
                        <span>${count}</span>
                    </div>
                `
                  )
                  .join("")}
            </div>
            <div>
                <h3>Top Owners</h3>
                ${topOwners
                  .map(
                    ([owner, count]) => `
                    <div class="stat-item">
                        <span>${owner}</span>
                        <span>${count}</span>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `;
}

// Clone Management
async function previewClone() {
  const results = document.getElementById("clone-results");
  results.innerHTML = '<div class="loading">Loading preview...</div>';

  try {
    const response = await fetch("/api/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true }),
    });

    const result = await response.json();

    if (response.ok) {
      // Generate folder hierarchy preview
      const hierarchyHtml = generateCloneHierarchyPreview(result.repositories);

      results.innerHTML = `
                <div class="success">
                    <h3>Clone Preview</h3>
                    <p>${result.message}</p>
                    <div class="clone-preview-container">
                        ${hierarchyHtml}
                    </div>
                </div>
            `;
    } else {
      results.innerHTML = `<div class="error">${result.error}</div>`;
    }
  } catch (error) {
    results.innerHTML = `<div class="error">Failed to preview clone: ${error.message}</div>`;
  }
}

function generateCloneHierarchyPreview(repositories) {
  // Generate vertical org-chart based on actual organizationConfig
  let html = '<div class="clone-hierarchy-succinct">';

  if (Object.keys(organizationConfig).length === 0) {
    // No organization - show default owner/repo structure with individual repos
    const ownerGroups = {};
    repositories.forEach((repo) => {
      const owner = repo.owner.login;
      const repoName = repo.name; // Just the repo name without owner
      if (!ownerGroups[owner]) {
        ownerGroups[owner] = [];
      }
      ownerGroups[owner].push(repoName);
    });

    Object.keys(ownerGroups)
      .sort()
      .forEach((owner) => {
        html += `<div class="clone-folder-path parent">${owner}/</div>`;
        ownerGroups[owner].sort().forEach((repoName) => {
          html += `<div class="clone-folder-path child">${repoName}</div>`; // Removed trailing slash for repo names
        });
      });
  } else {
    // Use actual organizationConfig to build org-chart with individual repos
    const repoMap = {};
    repositories.forEach((repo) => {
      repoMap[repo.full_name] = repo.name; // Map full name to just repo name
    });

    const folderStructure = {};

    // Build folder structure with actual repositories
    Object.entries(organizationConfig).forEach(([folderPath, repoNames]) => {
      if (folderPath.includes("_placeholder")) return; // Skip placeholder folders

      if (!folderStructure[folderPath]) {
        folderStructure[folderPath] = [];
      }

      repoNames.forEach((repoName) => {
        if (repoMap[repoName]) {
          folderStructure[folderPath].push(repoMap[repoName]); // Use just repo name without owner
        }
      });
    });

    // Group folders by parent and render with repositories
    const parentFolders = {};
    Object.keys(folderStructure).forEach((folderPath) => {
      const parts = folderPath.split("/");
      const parentName = parts[0];
      const childPath = parts.length > 1 ? parts.slice(1).join("/") : null;

      if (!parentFolders[parentName]) {
        parentFolders[parentName] = { direct: [], children: {} };
      }

      if (childPath) {
        if (!parentFolders[parentName].children[childPath]) {
          parentFolders[parentName].children[childPath] = [];
        }
        parentFolders[parentName].children[childPath] = folderStructure[folderPath];
      } else {
        parentFolders[parentName].direct = folderStructure[folderPath];
      }
    });

    // Render the org-chart with repositories
    Object.keys(parentFolders)
      .sort()
      .forEach((parentName) => {
        html += `<div class="clone-folder-path parent">${parentName}/</div>`;

        // Show direct repositories in parent folder
        parentFolders[parentName].direct.sort().forEach((repoName) => {
          html += `<div class="clone-folder-path child">${repoName}</div>`;
        });

        // Show child folders and their repositories
        Object.entries(parentFolders[parentName].children)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([childPath, repos]) => {
            html += `<div class="clone-folder-path child">${childPath}/</div>`;
            repos.sort().forEach((repoName) => {
              html += `<div class="clone-folder-path child" style="margin-left: 32px;">${repoName}</div>`;
            });
          });
      });
  }

  html += "</div>";
  return html;
}

let currentCloneSession = null;

// Terminal functions
function showTerminal() {
  const terminal = document.getElementById("clone-progress-terminal");
  terminal.classList.remove("hidden");
  terminalVisible = true;
}

function hideTerminal() {
  const terminal = document.getElementById("clone-progress-terminal");
  terminal.classList.add("hidden");
  terminalVisible = false;
}

function toggleTerminal() {
  // Not needed for embedded terminal
}

function closeTerminal() {
  hideTerminal();
  clearTerminal();
}

// Progress tracking functions
function initializeProgressTracking(repositories) {
  const progressList = document.getElementById("repository-progress-list");
  progressList.innerHTML = "";

  // Create progress items for each repository
  repositories.forEach((repo, index) => {
    const progressItem = document.createElement("div");
    progressItem.className = "repo-progress-item";
    progressItem.id = `repo-progress-${index}`;
    progressItem.innerHTML = `
      <div class="repo-name">${repo.full_name}</div>
      <div class="repo-status pending" id="repo-status-${index}">Pending</div>
      <div class="repo-progress-bar">
        <div class="repo-progress-fill" id="repo-progress-fill-${index}"></div>
      </div>
    `;
    progressList.appendChild(progressItem);
  });

  // Initialize overall progress
  updateOverallProgress(0, repositories.length);
}

function updateOverallProgress(current, total) {
  const progressFill = document.getElementById("overall-progress-fill");
  const progressText = document.getElementById("overall-progress-text");

  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressFill.style.width = `${percentage}%`;
  progressText.textContent = `${current} / ${total}`;
}

function updateRepositoryProgress(repoIndex, status, message) {
  const progressItem = document.getElementById(`repo-progress-${repoIndex}`);
  const statusElement = document.getElementById(`repo-status-${repoIndex}`);
  const progressFill = document.getElementById(`repo-progress-fill-${repoIndex}`);

  if (!progressItem || !statusElement || !progressFill) return;

  // Update status
  statusElement.className = `repo-status ${status}`;
  statusElement.textContent = message;

  // Update progress bar
  progressFill.className = `repo-progress-fill ${status}`;

  // Update progress item background
  progressItem.className = `repo-progress-item ${status}`;

  // Set progress fill width based on status
  switch (status) {
    case "in-progress":
      progressFill.style.width = "50%";
      break;
    case "success":
      progressFill.style.width = "100%";
      break;
    case "error":
      progressFill.style.width = "100%";
      break;
    default:
      progressFill.style.width = "0%";
  }
}

function clearTerminal() {
  const output = document.getElementById("terminal-output");
  output.innerHTML = "";
}

function addTerminalLine(message, type = "info") {
  const output = document.getElementById("terminal-output");
  const line = document.createElement("div");
  line.className = `terminal-line ${type}`;

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;

  output.appendChild(line);

  // Auto-scroll to bottom
  output.scrollTop = output.scrollHeight;
}

function formatDuration(startTime) {
  const duration = Date.now() - startTime;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

async function startClone() {
  const results = document.getElementById("clone-results");
  const startButton = document.querySelector('button[onclick="startClone()"]');

  // Provide immediate visual feedback
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Starting...";
  }

  results.innerHTML = '<div class="loading">Initializing clone process...</div>';

  // Show terminal and initialize
  clearTerminal();
  showTerminal();
  cloneStartTime = Date.now();
  addTerminalLine("Initializing clone process...", "info");

  try {
    console.log("Starting clone process...");

    // First, get the repository list for progress tracking
    addTerminalLine("📋 Loading repository list...", "info");
    const repoResponse = await fetch("/api/repositories");
    const repoData = await repoResponse.json();

    if (!repoResponse.ok) {
      throw new Error(repoData.error || "Failed to load repositories");
    }

    const repositoryList = repoData.repositories;
    addTerminalLine(`📊 Found ${repositoryList.length} repositories to clone`, "info");

    // Initialize progress tracking
    initializeProgressTracking(repositoryList);

    // Start the clone process
    const response = await fetch("/api/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: false }),
    });

    console.log("Clone API response:", response.status, response.statusText);

    const data = await response.json();
    console.log("Clone API data:", data);

    if (!response.ok) {
      throw new Error(data.error || "Clone failed");
    }

    currentCloneSession = data.sessionId;

    addTerminalLine(`🚀 Started cloning ${data.total} repositories (Session: ${data.sessionId})`, "info");

    // Set up progress tracking UI
    results.innerHTML = `
      <div class="clone-progress-container">
        <h3>Cloning ${data.total} repositories...</h3>
        <div class="progress-bar-container">
          <div class="progress-bar" id="clone-progress-bar">
            <div class="progress-fill" id="clone-progress-fill"></div>
          </div>
          <div class="progress-text" id="clone-progress-text">0 / ${data.total}</div>
        </div>
        <div class="current-activity" id="clone-current-activity">Initializing...</div>
        <div class="clone-actions">
          <button class="btn btn-danger" onclick="cancelClone()" id="cancel-clone-btn">Cancel Clone</button>
        </div>
        <div class="activity-log" id="clone-activity-log">
          <h4>Activity Log</h4>
          <div class="activity-items" id="clone-activity-items"></div>
        </div>
      </div>
    `;

    // Start listening for progress updates
    listenForCloneProgress(data.sessionId, data.total);
  } catch (error) {
    console.error("Clone error:", error);
    results.innerHTML = `<div class="error">Clone failed: ${error.message}</div>`;

    // Re-enable the start button
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = "Start cloning";
    }
  }
}

function listenForCloneProgress(sessionId, total) {
  console.log("Setting up SSE connection for session:", sessionId);
  const eventSource = new EventSource(`/api/clone/progress/${sessionId}`);

  eventSource.onopen = function (event) {
    console.log("SSE connection opened:", event);
  };

  eventSource.onmessage = function (event) {
    console.log("SSE message received:", event.data);
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "progress":
        updateCloneProgress(data.current, total, data.repository, data.message);
        addTerminalLine(`[${data.current}/${total}] ${data.message}`, "progress");

        // Add in-progress item to activity log
        addActivityLogItemInProgress(data.repository, "Cloning...");
        break;
      case "repository_complete":
        // Update the in-progress item to completed status
        updateActivityLogItem(data.repository.name, data.repository);

        updateCloneProgress(
          data.progress.current,
          total,
          null,
          `${data.progress.success} successful, ${data.progress.errors} failed`
        );

        // Update overall progress
        updateOverallProgress(data.progress.current, total);

        // Add terminal log for repository completion
        const repoType = data.repository.status === "success" ? "success" : "error";
        const repoMessage =
          data.repository.status === "success"
            ? `✓ ${data.repository.name}: ${data.repository.message}`
            : `✗ ${data.repository.name}: ${data.repository.message}`;
        addTerminalLine(repoMessage, repoType);
        break;
      case "complete":
        const duration = cloneStartTime ? formatDuration(cloneStartTime) : "unknown";
        addTerminalLine(
          `🎉 Clone process completed in ${duration}! ${data.summary.success} successful, ${data.summary.errors} failed`,
          "success"
        );
        completeClone(data);
        eventSource.close();
        break;
      case "cancelled":
        addTerminalLine("⚠️ Clone process was cancelled", "warning");
        cancelledClone();
        eventSource.close();
        break;
      case "cleanup_complete":
        addTerminalLine(
          `🧹 Cleanup completed: ${data.removed.length} repositories and folders removed from disk`,
          "info"
        );
        if (data.removed && data.removed.length > 0) {
          data.removed.forEach((repo) => {
            addTerminalLine(`  🗑️ Deleted: ${repo.name} (${repo.path})`, "success");
          });
        }
        addTerminalLine("💾 Target directory restored to original state", "success");

        // Show detailed cleanup summary in the main UI
        const currentActivity = document.getElementById("clone-current-activity");
        if (currentActivity) {
          currentActivity.innerHTML = `
            <div class="cleanup-summary">
              <strong>✅ Cleanup completed successfully</strong>
              <div>🧹 Removed ${data.removed.length} repositories and their folders from disk:</div>
              <ul class="cleanup-list">
                ${data.removed.map((repo) => `<li>🗑️ ${repo.name}</li>`).join("")}
              </ul>
              <div>💾 Your target directory has been completely restored to its original state.</div>
            </div>
          `;
        }
        break;
      case "error":
        console.error("Clone process error:", data.message);
        addTerminalLine(`❌ Clone process failed: ${data.message}`, "error");
        const results = document.getElementById("clone-results");
        if (results) {
          results.innerHTML = `<div class="error">Clone process failed: ${data.message}</div>`;
        }
        eventSource.close();
        break;
    }
  };

  eventSource.onerror = function (event) {
    console.error("Clone progress error:", event);
    eventSource.close();
  };
}

function updateCloneProgress(current, total, repository, message) {
  const progressFill = document.getElementById("clone-progress-fill");
  const progressText = document.getElementById("clone-progress-text");
  const currentActivity = document.getElementById("clone-current-activity");

  if (progressFill) {
    const percentage = (current / total) * 100;
    progressFill.style.width = `${percentage}%`;
  }

  if (progressText) {
    progressText.textContent = `${current} / ${total}`;
  }

  if (currentActivity) {
    if (repository) {
      currentActivity.textContent = `Cloning ${repository}...`;
    } else if (message) {
      currentActivity.textContent = message;
    }
  }
}

function addActivityLogItem(repository) {
  const activityItems = document.getElementById("clone-activity-items");
  if (activityItems) {
    const statusClass = repository.status === "success" ? "activity-success" : "activity-error";
    const statusIcon = repository.status === "success" ? "✅" : "❌";

    const item = document.createElement("div");
    item.className = `activity-item ${statusClass}`;
    item.innerHTML = `
      <div class="activity-content">
        <span class="activity-icon">${statusIcon}</span>
        <span class="activity-repo">${repository.name}</span>
        <span class="activity-message">${repository.message}</span>
      </div>
      <div class="activity-progress-bar">
        <div class="activity-progress-fill ${statusClass}"></div>
      </div>
    `;

    activityItems.appendChild(item);
    activityItems.scrollTop = activityItems.scrollHeight;
  }
}

function addActivityLogItemInProgress(repositoryName, message) {
  const activityItems = document.getElementById("clone-activity-items");
  if (activityItems) {
    const item = document.createElement("div");
    item.className = "activity-item activity-in-progress";
    item.id = `activity-${repositoryName.replace(/[^a-zA-Z0-9]/g, "-")}`;
    item.innerHTML = `
      <div class="activity-content">
        <span class="activity-icon">⏳</span>
        <span class="activity-repo">${repositoryName}</span>
        <span class="activity-message">${message}</span>
      </div>
      <div class="activity-progress-bar">
        <div class="activity-progress-fill activity-in-progress"></div>
      </div>
    `;
    // Insert at the top instead of bottom
    activityItems.insertBefore(item, activityItems.firstChild);
  }
}

function updateActivityLogItem(repositoryName, repository) {
  const itemId = `activity-${repositoryName.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const item = document.getElementById(itemId);
  if (item) {
    const statusClass = repository.status === "success" ? "activity-success" : "activity-error";
    const statusIcon = repository.status === "success" ? "✅" : "❌";

    item.className = `activity-item ${statusClass}`;
    item.innerHTML = `
      <div class="activity-content">
        <span class="activity-icon">${statusIcon}</span>
        <span class="activity-repo">${repository.name}</span>
        <span class="activity-message">${repository.message}</span>
      </div>
      <div class="activity-progress-bar">
        <div class="activity-progress-fill ${statusClass}"></div>
      </div>
    `;
  }
}

function completeClone(data) {
  const results = document.getElementById("clone-results");
  const cancelBtn = document.getElementById("cancel-clone-btn");

  // Store results for potential undo
  lastCloneResults = data.results.filter((result) => result.status === "success");

  if (cancelBtn) {
    cancelBtn.textContent = "Undo Clone";
    cancelBtn.onclick = undoClone;
    cancelBtn.className = "btn btn-warning";
    cancelBtn.disabled = false;
  }

  const currentActivity = document.getElementById("clone-current-activity");
  if (currentActivity) {
    currentActivity.innerHTML = `
      <div class="completion-summary">
        <strong>${data.message}</strong>
        <div class="summary-stats">
          Total: ${data.summary.total} |
          Success: <span class="success-count">${data.summary.success}</span> |
          Errors: <span class="error-count">${data.summary.errors}</span>
        </div>
        <div class="completion-actions">
          <button class="btn btn-purple" onclick="saveCompleteConfiguration()">
            <span class="material-icons">save</span>
            Save Configuration Files
          </button>
          <p class="completion-note">
            Save both .env and .clonehome files with the settings used in this clone operation.
          </p>
        </div>
      </div>
    `;
  }

  currentCloneSession = null;
}

async function saveCompleteConfiguration() {
  try {
    // Get current configuration
    const config = {
      token: document.getElementById("token").value,
      targetDir: document.getElementById("targetDir").value,
      includeOrgs: document.getElementById("includeOrgs").checked,
      includeForks: document.getElementById("includeForks").checked,
    };

    // Save .env file
    await exportToEnv();

    // Save .clonehome file (organization configuration)
    await saveConfigFile();

    showSuccess("✓ Configuration files saved successfully! Both .env and .clonehome files have been downloaded.");
  } catch (error) {
    console.error("Save configuration error:", error);
    showError("Failed to save configuration files: " + error.message);
  }
}

async function cancelClone() {
  if (!currentCloneSession) return;

  const cancelBtn = document.getElementById("cancel-clone-btn");
  const currentActivity = document.getElementById("clone-current-activity");

  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.textContent = "Cancelling...";
  }

  addTerminalLine("🛑 Cancelling clone process and cleaning up...", "warning");

  if (currentActivity) {
    currentActivity.textContent = "Cancelling clone process and removing all cloned repositories from disk...";
  }

  try {
    const response = await fetch(`/api/clone/cancel/${currentCloneSession}`, {
      method: "POST",
    });

    const data = await response.json();

    if (response.ok) {
      if (currentActivity) {
        currentActivity.innerHTML = `
          <div class="cancellation-summary">
            <strong>✅ Clone process cancelled successfully</strong>
            <div>🧹 All cloned repositories and their folders have been completely removed from disk.</div>
            <div>💾 Your target directory has been restored to its original state.</div>
          </div>
        `;
      }
    } else {
      throw new Error(data.error || "Failed to cancel");
    }
  } catch (error) {
    console.error("Error cancelling clone:", error);
    if (currentActivity) {
      currentActivity.innerHTML = `
        <div class="error-summary">
          <strong>❌ Error cancelling clone</strong>
          <div>${error.message}</div>
        </div>
      `;
    }
  }
}

function cancelledClone() {
  const results = document.getElementById("clone-results");

  // Show cancellation message briefly, then reset
  results.innerHTML = `
    <div class="warning">
      <h3>Clone process cancelled</h3>
      <p>The clone operation was cancelled and all cloned repositories have been removed.</p>
      <p>You can start a new clone operation below.</p>
    </div>
  `;

  // Hide the terminal
  hideTerminal();

  // Reset session
  currentCloneSession = null;

  // Reset the page after a brief delay to show the cancellation message
  setTimeout(() => {
    resetClonePage();
  }, 3000);
}

function resetClonePage() {
  const results = document.getElementById("clone-results");
  results.innerHTML = "";

  // Reset the start button
  const startButton = document.querySelector('button[onclick="startClone()"]');
  if (startButton) {
    startButton.disabled = false;
    startButton.textContent = "Start cloning";
  }

  // Clear terminal content
  clearTerminal();

  // Reset any other state variables
  currentCloneSession = null;
  lastCloneResults = null;
}

let lastCloneResults = null;

function undoClone() {
  if (!lastCloneResults) {
    alert("No clone operation to undo");
    return;
  }

  const confirmUndo = confirm(
    `This will delete all ${lastCloneResults.length} cloned repositories from your disk. Are you sure?`
  );

  if (!confirmUndo) return;

  performUndoClone();
}

async function performUndoClone() {
  const results = document.getElementById("clone-results");

  results.innerHTML = `
    <div class="clone-progress-container">
      <h3>🧹 Undoing clone operation...</h3>
      <div class="current-activity" id="undo-activity">Removing all cloned repositories and folders from disk...</div>
      <div class="activity-log" id="undo-activity-log">
        <h4>📋 Cleanup Progress</h4>
        <div class="activity-items" id="undo-activity-items"></div>
      </div>
    </div>
  `;

  try {
    const response = await fetch("/api/clone/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: lastCloneResults }),
    });

    const data = await response.json();

    if (response.ok) {
      const undoActivity = document.getElementById("undo-activity");
      if (undoActivity) {
        undoActivity.innerHTML = `
          <div class="completion-summary">
            <strong>✅ Undo completed successfully</strong>
            <div>🧹 All ${data.removed.length} cloned repositories and their folders have been completely removed from disk.</div>
            <div>💾 Your target directory has been restored to its original state.</div>
          </div>
        `;
      }

      // Add removal log items
      if (data.removed && data.removed.length > 0) {
        const undoActivityItems = document.getElementById("undo-activity-items");
        if (undoActivityItems) {
          data.removed.forEach((item) => {
            const activityItem = document.createElement("div");
            activityItem.className = "activity-item activity-success";
            activityItem.innerHTML = `
              <span class="activity-icon">🗑️</span>
              <span class="activity-repo">${item.name}</span>
              <span class="activity-message">Removed from ${item.path}</span>
            `;
            undoActivityItems.appendChild(activityItem);
          });
        }
      }

      lastCloneResults = null;
    } else {
      throw new Error(data.error || "Undo failed");
    }
  } catch (error) {
    const undoActivity = document.getElementById("undo-activity");
    if (undoActivity) {
      undoActivity.innerHTML = `
        <div class="error-summary">
          <strong>❌ Error during undo</strong>
          <div>${error.message}</div>
        </div>
      `;
    }
  }
}

// Utility functions
function showError(message) {
  const existing = document.querySelector(".error");
  if (existing) existing.remove();

  const error = document.createElement("div");
  error.className = "error";
  error.textContent = message;
  document.querySelector(".container").insertBefore(error, document.querySelector(".tabs"));

  setTimeout(() => error.remove(), 5000);
}

function showSuccess(message) {
  const existing = document.querySelector(".success");
  if (existing) existing.remove();

  const success = document.createElement("div");
  success.className = "success";
  success.textContent = message;
  document.querySelector(".container").insertBefore(success, document.querySelector(".tabs"));

  setTimeout(() => success.remove(), 5000);
}

// Organization Functions
async function loadOrganizationConfig() {
  try {
    const response = await fetch("/api/organization");
    const result = await response.json();

    if (response.ok && result.organization) {
      organizationConfig = result.organization;
    }
  } catch (error) {
    console.error("Failed to load organization config:", error);
  }
}

async function saveOrganizationConfig() {
  // Get the save button for immediate feedback
  const saveButton = document.querySelector('button[onclick="saveOrganizationConfig()"]');
  const originalText = saveButton ? saveButton.innerHTML : null;

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="material-icons">hourglass_empty</span> Saving...';
  }

  try {
    // Clean the organization config to ensure it's valid JSON
    const cleanConfig = {};
    Object.entries(organizationConfig).forEach(([folderName, repos]) => {
      if (folderName && Array.isArray(repos) && repos.length > 0) {
        cleanConfig[folderName] = repos.filter((repo) => typeof repo === "string" && repo.trim());
      }
    });

    console.log("Saving organization config:", cleanConfig);

    const response = await fetch("/api/organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization: cleanConfig }),
    });

    const result = await response.json();

    if (response.ok) {
      showSuccess("Organization saved to server!");

      // Show success on button temporarily
      if (saveButton) {
        saveButton.innerHTML = '<span class="material-icons">check_circle</span> Saved!';
        setTimeout(() => {
          saveButton.innerHTML = originalText;
          saveButton.disabled = false;
        }, 2000);
      }
    } else {
      showError(result.error);

      // Reset button on error
      if (saveButton) {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
      }
    }
  } catch (error) {
    console.error("Save organization error:", error);
    showError("Failed to save organization: " + error.message);

    // Reset button on error
    if (saveButton) {
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
    }
  }
}

function initializeOrganizer() {
  displayUnorganizedRepos();
  displayOrganizedStructure();
}

function displayUnorganizedRepos() {
  const container = document.getElementById("unorganized-repos");

  // Clear existing content
  container.innerHTML = "";

  const unorganizedRepos = repositories.filter((repo) => !isRepoOrganized(repo));

  if (unorganizedRepos.length === 0) {
    container.innerHTML = '<div class="empty-state">All repositories are organized!</div>';
    updateMultiSelectControls();
    return;
  }

  container.innerHTML = unorganizedRepos
    .map(
      (repo) => `
        <div class="draggable-repo ${selectedRepos.has(repo.full_name) ? "selected" : ""}"
             draggable="true"
             data-repo="${repo.full_name}"
             onclick="toggleRepoSelection('${repo.full_name}', event)">
            <label class="checkbox-label" onclick="event.stopPropagation();">
                <input type="checkbox"
                       class="styled-checkbox selection-checkbox"
                       onchange="toggleRepoSelection('${repo.full_name}', event)"
                       ${selectedRepos.has(repo.full_name) ? "checked" : ""}>
                <span class="checkbox-custom"></span>
            </label>
            <div class="repo-content">
                <div class="repo-name">${repo.full_name}</div>
                <div class="repo-meta">
                    ${
                      repo.private
                        ? '<span class="material-icons repo-icon-small" data-private="true">lock</span>'
                        : '<span class="material-icons repo-icon-small" data-private="false">public</span>'
                    }${repo.language ? ` &emsp; ${repo.language}` : ""} · ${formatDate(repo.updated_at)}
                </div>
            </div>
            <div class="drag-handle">
                <span class="material-icons">drag_indicator</span>
            </div>
        </div>
    `
    )
    .join("");

  // Add drag event listeners
  container.querySelectorAll(".draggable-repo").forEach((repo) => {
    repo.addEventListener("dragstart", handleDragStart);
    repo.addEventListener("dragend", handleDragEnd);
  });

  updateMultiSelectControls();
}

function displayOrganizedStructure() {
  const container = document.getElementById("organized-structure");

  if (Object.keys(organizationConfig).length === 0) {
    container.innerHTML = '<div class="empty-state">Drag repositories here to organize them</div>';
    return;
  }

  // Group folders by parent (everything before the first slash)
  const parentGroups = {};
  Object.entries(organizationConfig).forEach(([folderPath, repos]) => {
    const parts = folderPath.split("/");
    const parentFolder = parts[0];
    const childFolder = parts.slice(1).join("/");

    if (!parentGroups[parentFolder]) {
      parentGroups[parentFolder] = {};
    }

    if (childFolder) {
      // This is a nested folder (parent/child)
      parentGroups[parentFolder][childFolder] = repos;
    } else {
      // This is a top-level folder
      parentGroups[parentFolder]["_direct"] = repos;
    }
  });

  console.log("Parent groups:", parentGroups);

  container.innerHTML = Object.entries(parentGroups)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort parent folders alphabetically
    .map(([parentName, children]) => {
      const totalRepos = Object.values(children).reduce((sum, repos) => sum + repos.length, 0);

      return `
        <div class="folder">
            <div class="folder-header" onclick="toggleFolder('${parentName}')">
                <span class="folder-name"><span class="material-icons">folder</span>${parentName}</span>
                <div>
                    <span class="folder-count">${totalRepos}</span>
                    <button class="rename-folder-btn" onclick="event.stopPropagation(); renameParentFolder('${parentName}')" title="Rename folder"><span class="material-icons">edit</span></button>
                    <button class="delete-folder-btn" onclick="event.stopPropagation(); deleteParentFolder('${parentName}')" title="Delete folder"><span class="material-icons">delete</span></button>
                </div>
            </div>
            <div class="folder-content" data-folder="${parentName}">
                ${Object.entries(children)
                  .sort(([a], [b]) => {
                    // Sort _direct and _placeholder first, then alphabetically
                    if (a === "_direct") return -1;
                    if (b === "_direct") return 1;
                    if (a === "_placeholder") return -1;
                    if (b === "_placeholder") return 1;
                    return a.localeCompare(b);
                  })
                  .map(([childName, repos]) => {
                    // Sort repositories within each folder alphabetically
                    const sortedRepos = [...repos].sort((a, b) => a.localeCompare(b));
                    if (childName === "_direct") {
                      // Direct repos in parent folder
                      return sortedRepos
                        .map(
                          (repoName) => `
                      <div class="folder-repo">
                          <span class="repo-name">${repoName}</span>
                          <button class="remove-btn" onclick="removeRepoFromFolder('${parentName}', '${repoName}')">Remove</button>
                      </div>
                    `
                        )
                        .join("");
                    } else if (childName === "_placeholder") {
                      // Empty parent folder placeholder
                      return `<div class="empty-folder-placeholder">Drop repositories here</div>`;
                    } else {
                      // Child folder
                      const fullPath = `${parentName}/${childName}`;
                      return `
                      <div class="child-folder">
                          <div class="child-folder-header">
                              <span class="folder-name"><span class="material-icons">folder_open</span>${childName}</span>
                              <div>
                                  <span class="folder-count">${sortedRepos.length}</span>
                                  <button class="rename-folder-btn" onclick="event.stopPropagation(); renameChildFolder('${parentName}', '${childName}')" title="Rename subfolder"><span class="material-icons">edit</span></button>
                              </div>
                          </div>
                          ${sortedRepos
                            .map(
                              (repoName) => `
                            <div class="folder-repo child-repo" draggable="true" data-repo="${repoName}" data-source-folder="${fullPath}">
                                <span class="repo-name">${repoName}</span>
                                <button class="remove-btn" onclick="removeRepoFromFolder('${fullPath}', '${repoName}')">Remove</button>
                            </div>
                          `
                            )
                            .join("")}
                      </div>
                    `;
                    }
                  })
                  .join("")}
            </div>
        </div>
      `;
    })
    .join("");

  // Remove existing event listeners from main container to avoid conflicts
  container.removeEventListener("dragover", handleDragOver);
  container.removeEventListener("drop", handleDropOnStructure);
  container.removeEventListener("dragenter", handleDragEnter);
  container.removeEventListener("dragleave", handleDragLeave);

  // Add drop event listeners to folder contents (higher priority)
  container.querySelectorAll(".folder-content").forEach((folder) => {
    folder.addEventListener("dragover", handleDragOver);
    folder.addEventListener("drop", handleDrop);
    folder.addEventListener("dragenter", handleDragEnter);
    folder.addEventListener("dragleave", handleDragLeave);
    console.log("Added drop listeners to folder:", folder.dataset.folder);
  });

  // Add drag event listeners to organized repos
  container.querySelectorAll(".folder-repo[draggable]").forEach((repo) => {
    repo.addEventListener("dragstart", handleOrganizedRepoDragStart);
    repo.addEventListener("dragend", handleDragEnd);
  });

  // Add drop event listener to main container (lower priority, only for empty space)
  container.addEventListener("dragover", handleDragOver);
  container.addEventListener("drop", handleDropOnStructure);
  container.addEventListener("dragenter", handleDragEnter);
  container.addEventListener("dragleave", handleDragLeave);
}

function isRepoOrganized(repo) {
  return Object.values(organizationConfig).some((repos) => repos.includes(repo.full_name));
}

// Multi-select functions
function toggleRepoSelection(repoName, event) {
  event.stopPropagation();

  if (selectedRepos.has(repoName)) {
    selectedRepos.delete(repoName);
  } else {
    selectedRepos.add(repoName);
  }

  // Update visual state
  const repoElement = document.querySelector(`[data-repo="${repoName}"]`);
  const checkbox = repoElement.querySelector(".selection-checkbox");

  if (selectedRepos.has(repoName)) {
    repoElement.classList.add("selected");
    checkbox.checked = true;
  } else {
    repoElement.classList.remove("selected");
    checkbox.checked = false;
  }

  updateMultiSelectControls();
}

function selectAll() {
  const unorganizedRepos = repositories.filter((repo) => !isRepoOrganized(repo));
  unorganizedRepos.forEach((repo) => selectedRepos.add(repo.full_name));
  displayUnorganizedRepos();
}

function clearSelection() {
  selectedRepos.clear();
  displayUnorganizedRepos();
}

function updateMultiSelectControls() {
  const controls = document.getElementById("multi-select-controls");
  const countElement = document.getElementById("selected-count");

  if (selectedRepos.size > 0) {
    controls.classList.add("active");
    countElement.textContent = `${selectedRepos.size} selected`;
  } else {
    controls.classList.remove("active");
  }
}

function moveSelectedToFolder() {
  if (selectedRepos.size === 0) {
    alert("No repositories selected");
    return;
  }

  // Move selected repos to a default "selected" parent folder
  const defaultParentFolder = "selected";

  selectedRepos.forEach((repoName) => {
    const repoFolderName = repoName.split("/").pop();
    const fullPath = `${defaultParentFolder}/${repoFolderName}`;
    addRepoToFolder(fullPath, repoName);
  });

  clearSelection();
}

// Drag and Drop Event Handlers
function handleDragStart(e) {
  draggedRepo = e.target.dataset.repo;
  e.target.classList.add("dragging");

  // If dragging a selected repo and there are multiple selected, drag all selected
  if (selectedRepos.has(draggedRepo) && selectedRepos.size > 1) {
    e.dataTransfer.setData("text/plain", Array.from(selectedRepos).join(","));
  } else {
    e.dataTransfer.setData("text/plain", draggedRepo);
  }
}

function handleOrganizedRepoDragStart(e) {
  draggedRepo = e.target.dataset.repo;
  const sourceFolder = e.target.dataset.sourceFolder;
  e.target.classList.add("dragging");

  // Store both repo name and source folder for organized repos
  e.dataTransfer.setData("text/plain", draggedRepo);
  e.dataTransfer.setData("source-folder", sourceFolder);
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  draggedRepo = null;
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDragEnter(e) {
  e.preventDefault();
  const target = e.target.closest(".folder-content") || e.target.closest(".folder-structure");
  if (target) {
    target.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  const target = e.target.closest(".folder-content") || e.target.closest(".folder-structure");
  if (target && !target.contains(e.relatedTarget)) {
    target.classList.remove("drag-over");
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation(); // Prevent event bubbling

  const target = e.target.closest(".folder-content");
  if (target) {
    target.classList.remove("drag-over");
  }

  const reposData = e.dataTransfer.getData("text/plain");
  const sourceFolder = e.dataTransfer.getData("source-folder");
  if (!reposData) return;

  const reposToMove = reposData.split(",");
  const parentFolderName = target?.dataset.folder;

  console.log("handleDrop:", { parentFolderName, reposToMove, target });

  if (parentFolderName) {
    // Dropping into an existing parent folder
    reposToMove.forEach((repoName) => {
      // If moving from an organized folder, remove from source first
      if (sourceFolder) {
        removeRepoFromFolder(sourceFolder, repoName);
      }

      const repoFolderName = repoName.split("/").pop();
      const fullPath = `${parentFolderName}/${repoFolderName}`;
      console.log("Adding repo to folder:", { fullPath, repoName });
      addRepoToFolder(fullPath, repoName);
    });

    // Clear selection if we moved selected repos
    if (reposToMove.some((repo) => selectedRepos.has(repo))) {
      clearSelection();
    }

    return; // Important: prevent handleDropOnStructure from running
  }
}

function handleDropOnStructure(e) {
  e.preventDefault();
  e.target.classList.remove("drag-over");

  const reposData = e.dataTransfer.getData("text/plain");
  if (!reposData) return;

  const reposToMove = reposData.split(",");

  console.log("handleDropOnStructure called:", { target: e.target, reposToMove });

  // Only create folder if we're actually dropping on empty space
  // Check if we're dropping on the main container, not inside a folder
  const isMainContainer =
    e.target.id === "organized-structure" ||
    e.target.classList.contains("empty-state") ||
    e.target.classList.contains("folder-structure");

  console.log("Drop target check:", {
    targetId: e.target.id,
    targetClasses: e.target.className,
    isMainContainer,
  });

  if (isMainContainer) {
    // Create a folder named after the repository itself when dropping on empty space
    reposToMove.forEach((repoName) => {
      const repoFolderName = repoName.split("/").pop(); // Get just the repo name
      const fullPath = repoFolderName; // Use repo name as the folder name in root
      console.log("Creating folder for repo:", { repoName, repoFolderName, fullPath });
      addRepoToFolder(fullPath, repoName);
    });

    // Clear selection if we moved selected repos
    if (reposToMove.some((repo) => selectedRepos.has(repo))) {
      clearSelection();
    }
  } else {
    console.log("Drop target not recognized as main container");
  }
}

// Folder Management
function addRepoToFolder(folderName, repoName) {
  // Validate inputs
  if (!folderName || typeof folderName !== "string" || !folderName.trim()) {
    console.error("Invalid folder name:", folderName);
    return;
  }

  if (!repoName || typeof repoName !== "string" || !repoName.trim()) {
    console.error("Invalid repo name:", repoName);
    return;
  }

  const cleanFolderName = folderName.trim();
  const cleanRepoName = repoName.trim();

  if (!organizationConfig[cleanFolderName]) {
    organizationConfig[cleanFolderName] = [];
  }

  // Remove from other folders first
  Object.keys(organizationConfig).forEach((folder) => {
    organizationConfig[folder] = organizationConfig[folder].filter((repo) => repo !== cleanRepoName);
  });

  // Add to new folder
  if (!organizationConfig[cleanFolderName].includes(cleanRepoName)) {
    organizationConfig[cleanFolderName].push(cleanRepoName);
  }

  // Clean up empty folders (but keep placeholder folders)
  Object.keys(organizationConfig).forEach((folder) => {
    if (organizationConfig[folder].length === 0 && !folder.endsWith("/_placeholder")) {
      delete organizationConfig[folder];
    }
  });

  // Remove placeholder when adding real repos to a parent folder
  const parentFolder = cleanFolderName.split("/")[0];
  const placeholderKey = `${parentFolder}/_placeholder`;
  if (organizationConfig[placeholderKey] && cleanFolderName !== placeholderKey) {
    delete organizationConfig[placeholderKey];
  }

  // Remove from selection if it was selected
  selectedRepos.delete(cleanRepoName);

  // Refresh display
  initializeOrganizer();

  // Auto-save to server (with delay to avoid rapid saves)
  clearTimeout(window.saveTimeout);
  window.saveTimeout = setTimeout(() => {
    saveOrganizationConfig();
  }, 500);
}

function removeRepoFromFolder(folderName, repoName) {
  if (organizationConfig[folderName]) {
    organizationConfig[folderName] = organizationConfig[folderName].filter((repo) => repo !== repoName);

    // Remove folder if empty
    if (organizationConfig[folderName].length === 0) {
      delete organizationConfig[folderName];
    }

    initializeOrganizer();
  }
}

function deleteFolder(folderName) {
  if (
    confirm(
      `Are you sure you want to delete the "${folderName}" folder? Repositories will be moved back to unorganized.`
    )
  ) {
    delete organizationConfig[folderName];
    initializeOrganizer();
  }
}

function renameParentFolder(oldParentName) {
  const newParentName = prompt(`Rename folder "${oldParentName}" to:`, oldParentName);

  if (!newParentName || !newParentName.trim() || newParentName.trim() === oldParentName) {
    return; // User cancelled or entered same name
  }

  const trimmedNewName = newParentName.trim();

  // Check if new parent folder name already exists
  const existingParent = Object.keys(organizationConfig).some(
    (folder) => folder === trimmedNewName || folder.startsWith(trimmedNewName + "/")
  );

  if (existingParent) {
    alert(`Folder "${trimmedNewName}" already exists!`);
    return;
  }

  // Get all folders that start with the old parent name
  const foldersToRename = Object.keys(organizationConfig).filter(
    (folder) => folder === oldParentName || folder.startsWith(oldParentName + "/")
  );

  // Create new folder structure with renamed parent
  const newConfig = { ...organizationConfig };

  foldersToRename.forEach((oldFolder) => {
    const repos = organizationConfig[oldFolder];

    // Create new folder name by replacing the parent part
    let newFolder;
    if (oldFolder === oldParentName) {
      newFolder = trimmedNewName;
    } else {
      newFolder = oldFolder.replace(oldParentName + "/", trimmedNewName + "/");
    }

    // Add to new config and remove old
    newConfig[newFolder] = repos;
    delete newConfig[oldFolder];
  });

  // Update the organization config
  organizationConfig = newConfig;

  initializeOrganizer();
  showSuccess(`Renamed folder "${oldParentName}" to "${trimmedNewName}"`);

  // Auto-save to server
  clearTimeout(window.saveTimeout);
  window.saveTimeout = setTimeout(() => {
    saveOrganizationConfig();
  }, 500);
}

function renameChildFolder(parentName, oldChildName) {
  const newChildName = prompt(`Rename subfolder "${oldChildName}" to:`, oldChildName);

  if (!newChildName || !newChildName.trim() || newChildName.trim() === oldChildName) {
    return; // User cancelled or entered same name
  }

  const trimmedNewName = newChildName.trim();
  const oldFullPath = `${parentName}/${oldChildName}`;
  const newFullPath = `${parentName}/${trimmedNewName}`;

  // Check if new child folder name already exists
  if (organizationConfig[newFullPath]) {
    alert(`Subfolder "${trimmedNewName}" already exists in "${parentName}"!`);
    return;
  }

  // Move repositories from old path to new path
  if (organizationConfig[oldFullPath]) {
    organizationConfig[newFullPath] = organizationConfig[oldFullPath];
    delete organizationConfig[oldFullPath];

    initializeOrganizer();
    showSuccess(`Renamed subfolder "${oldChildName}" to "${trimmedNewName}"`);

    // Auto-save to server
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
      saveOrganizationConfig();
    }, 500);
  }
}

function deleteParentFolder(parentName) {
  // Find all folders that start with this parent name
  const foldersToDelete = Object.keys(organizationConfig).filter(
    (folder) => folder === parentName || folder.startsWith(parentName + "/")
  );

  if (foldersToDelete.length === 0) return;

  const totalRepos = foldersToDelete.reduce((sum, folder) => sum + organizationConfig[folder].length, 0);

  if (
    confirm(
      `Are you sure you want to delete the "${parentName}" parent folder and all its contents?\n` +
        `This will remove ${foldersToDelete.length} folder(s) containing ${totalRepos} repositories.\n` +
        `Repositories will be moved back to unorganized.`
    )
  ) {
    foldersToDelete.forEach((folder) => {
      delete organizationConfig[folder];
    });
    initializeOrganizer();
  }
}

function toggleFolder(folderName) {
  const folder = document.querySelector(`[data-folder="${folderName}"]`);
  if (folder) {
    folder.classList.toggle("collapsed");
  }
}

function addNewFolder() {
  const folderName = prompt("Enter new parent folder name:");
  if (folderName && folderName.trim()) {
    const name = folderName.trim();
    // Check if parent folder already exists (any folder starting with this name)
    const existingParent = Object.keys(organizationConfig).some(
      (folder) => folder === name || folder.startsWith(name + "/")
    );

    if (!existingParent) {
      // Create an empty parent folder by adding a placeholder
      organizationConfig[`${name}/_placeholder`] = [];
      displayOrganizedStructure();
      showSuccess(`Created parent folder "${name}" - drag repositories into it!`);
    } else {
      alert("Parent folder already exists!");
    }
  }
}

// Config File Management
async function saveConfigFile() {
  // Prompt user for filename prefix
  const userInput = prompt("Enter a name for your config file:", "my-setup");
  if (!userInput || !userInput.trim()) {
    return; // User cancelled or entered empty name
  }

  const cleanInput = userInput.trim().replace(/[^a-zA-Z0-9-_]/g, "-"); // Clean filename
  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd format
  const filename = `${cleanInput}-${today}.clonehome`;

  const config = {
    version: "1.0",
    created: new Date().toISOString(),
    organization: organizationConfig,
    metadata: {
      configName: cleanInput,
      createdDate: today,
      totalFolders: Object.keys(organizationConfig).length,
      totalOrganizedRepos: Object.values(organizationConfig).reduce((sum, repos) => sum + repos.length, 0),
    },
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Also save to server
  await saveOrganizationConfig();

  showSuccess(`Config saved as: ${filename}`);
}

function loadConfigFile() {
  document.getElementById("configFileInput").click();
}

function importConfigFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const config = JSON.parse(e.target.result);

      if (config.organization) {
        // Merge with existing config, keeping existing organization for repos not in the file
        const existingRepos = new Set();
        Object.values(organizationConfig).forEach((repos) => {
          repos.forEach((repo) => existingRepos.add(repo));
        });

        // Import the new organization
        organizationConfig = { ...config.organization };

        // Find repositories that exist but aren't in the imported config
        const importedRepos = new Set();
        Object.values(organizationConfig).forEach((repos) => {
          repos.forEach((repo) => importedRepos.add(repo));
        });

        const unorganizedRepos = repositories.filter((repo) => !importedRepos.has(repo.full_name));

        if (unorganizedRepos.length > 0) {
          const addToFolder = confirm(
            `Found ${unorganizedRepos.length} repositories not in the imported config. ` +
              `Would you like to add them to a "New Repositories" folder?`
          );

          if (addToFolder) {
            organizationConfig["New Repositories"] = unorganizedRepos.map((repo) => repo.full_name);
          }
        }

        initializeOrganizer();

        // Automatically save the imported organization to the backend
        saveOrganizationConfig()
          .then(() => {
            showSuccess(
              `Config imported and saved successfully! Loaded ${Object.keys(organizationConfig).length} folders.`
            );
          })
          .catch((error) => {
            showError(`Config imported but failed to save: ${error.message}`);
          });
      } else {
        showError("Invalid config file format");
      }
    } catch (error) {
      showError("Failed to parse config file: " + error.message);
    }
  };

  reader.readAsText(file);
  event.target.value = ""; // Reset file input
}

function autoOrganizeByOwner() {
  if (repositories.length === 0) {
    showError("Load repositories first");
    return;
  }

  const confirm = window.confirm(
    "This will organize repositories by owner into separate parent folders. " +
      "⚠️ WARNING: This will completely overwrite any existing organization structure. Continue?"
  );

  if (!confirm) return;

  // Clear existing organization first
  organizationConfig = {};

  // Create parent folders based on repository owner
  let organizedCount = 0;
  repositories.forEach((repo) => {
    const owner = repo.full_name.split("/")[0];
    const repoFolderName = repo.full_name.split("/").pop();
    const fullPath = `${owner}/${repoFolderName}`;
    addRepoToFolder(fullPath, repo.full_name);
    organizedCount++;
  });

  initializeOrganizer();
  showSuccess(`Auto-organized ${organizedCount} repositories by owner!`);
}

function autoOrganizeByLanguage() {
  if (repositories.length === 0) {
    showError("Load repositories first");
    return;
  }

  const confirm = window.confirm(
    "This will organize repositories by programming language into separate folders. " +
      "⚠️ WARNING: This will completely overwrite any existing organization structure. Continue?"
  );

  if (!confirm) return;

  // Clear existing organization first
  organizationConfig = {};

  // Create folders based on repository language
  let organizedCount = 0;
  repositories.forEach((repo) => {
    const language = repo.language || "Other";
    addRepoToFolder(language, repo.full_name);
    organizedCount++;
  });

  initializeOrganizer();
  showSuccess(`Auto-organized ${organizedCount} repositories by language!`);
}

function autoOrganizeByYear() {
  if (repositories.length === 0) {
    showError("Load repositories first");
    return;
  }

  const confirm = window.confirm(
    "This will organize repositories by the year they were last updated. " +
      "⚠️ WARNING: This will completely overwrite any existing organization structure. Continue?"
  );

  if (!confirm) return;

  // Clear existing organization first
  organizationConfig = {};

  // Create folders based on repository last updated year
  let organizedCount = 0;
  repositories.forEach((repo) => {
    const updatedDate = new Date(repo.updated_at);
    const year = updatedDate.getFullYear().toString();
    addRepoToFolder(year, repo.full_name);
    organizedCount++;
  });

  initializeOrganizer();
  showSuccess(`Auto-organized ${organizedCount} repositories by year!`);
}

// Setup real-time env file monitoring
function setupEnvStatusMonitoring() {
  if (envStatusEventSource) {
    envStatusEventSource.close();
  }

  // Use relative URL to automatically use the correct port
  const eventSourceUrl = "/api/env-status";
  console.log(`Setting up EventSource connection to: ${window.location.origin}${eventSourceUrl}`);

  envStatusEventSource = new EventSource(eventSourceUrl);

  envStatusEventSource.onmessage = function (event) {
    try {
      const envStatus = JSON.parse(event.data);
      updateEnvIndicators(envStatus);
    } catch (error) {
      console.error("Error parsing env status:", error);
    }
  };

  envStatusEventSource.onerror = function (error) {
    console.error("EventSource failed:", error);
    console.error("Make sure you're accessing the correct URL: http://localhost:3847");
    console.error(
      "If you're seeing 404 errors for /api/env-status, check that the server is running on the correct port"
    );

    // Don't auto-reconnect on 404 errors to avoid spam
    if (envStatusEventSource.readyState === EventSource.CLOSED) {
      console.error("EventSource connection closed. Manual refresh may be required.");
      return;
    }

    // Attempt to reconnect after 5 seconds for other errors
    setTimeout(() => {
      setupEnvStatusMonitoring();
    }, 5000);
  };
}

function updateEnvIndicators(envStatus) {
  // Update token indicator
  const tokenInput = document.getElementById("token");
  const tokenIndicator = document.getElementById("token-env-indicator");

  if (envStatus.hasToken) {
    tokenInput.classList.add("has-env-value");
    tokenInput.placeholder = "Override .env value or leave empty to use .env";
    tokenInput.value = "";
    tokenIndicator.classList.add("env-indicator-visible");
    tokenIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  } else {
    tokenInput.classList.remove("has-env-value");
    tokenInput.placeholder = "Enter your GitHub personal access token";
    tokenIndicator.classList.remove("env-indicator-visible");
  }

  // Update target directory indicator
  const targetDirInput = document.getElementById("targetDir");
  const targetDirIndicator = document.getElementById("targetDir-env-indicator");

  if (envStatus.hasTargetDir) {
    targetDirInput.classList.add("has-env-value");
    targetDirIndicator.classList.add("env-indicator-visible");
    targetDirIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  } else {
    targetDirInput.classList.remove("has-env-value");
    targetDirIndicator.classList.remove("env-indicator-visible");
  }

  // Update include orgs indicator
  const includeOrgsInput = document.getElementById("includeOrgs");
  const includeOrgsIndicator = document.getElementById("includeOrgs-env-indicator");

  if (envStatus.hasIncludeOrgs) {
    includeOrgsInput.classList.add("has-env-value");
    includeOrgsIndicator.classList.add("env-indicator-visible");
    includeOrgsIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  } else {
    includeOrgsInput.classList.remove("has-env-value");
    includeOrgsIndicator.classList.remove("env-indicator-visible");
  }

  // Update include forks indicator
  const includeForksInput = document.getElementById("includeForks");
  const includeForksIndicator = document.getElementById("includeForks-env-indicator");

  if (envStatus.hasIncludeForks) {
    includeForksInput.classList.add("has-env-value");
    includeForksIndicator.classList.add("env-indicator-visible");
    includeForksIndicator.innerHTML =
      '<span class="material-icons checkmark">check_circle</span><span>Available in .env file</span>';
  } else {
    includeForksInput.classList.remove("has-env-value");
    includeForksIndicator.classList.remove("env-indicator-visible");
  }
}

// Memory monitoring function
function logMemoryUsage() {
  if (performance.memory) {
    const memory = performance.memory;
    console.log(`Memory Usage:
      Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
      Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
      Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
      Repositories in memory: ${repositories.length}
      Organization folders: ${Object.keys(organizationConfig).length}`);
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  setupEnvStatusMonitoring();

  // Initialize the correct tab based on URL hash
  initializeTabFromHash();

  // Log memory usage periodically in development
  if (window.location.hostname === "localhost") {
    setInterval(logMemoryUsage, 30000); // Every 30 seconds
  }
});
