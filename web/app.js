let repositories = [];
let filteredRepositories = [];
let organizationConfig = {};
let draggedRepo = null;
let selectedRepos = new Set();
let envStatusEventSource = null;

// Helper function to format date as YYYY-MM-DD
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

// Helper function to clean up event listeners to prevent memory leaks
function cleanupEventListeners(container) {
  // Clone and replace container to remove all event listeners
  const newContainer = container.cloneNode(true);
  container.parentNode.replaceChild(newContainer, container);
  return newContainer;
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
function showTab(tabName) {
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

  // Add active class to clicked tab
  event.target.classList.add("active");

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

  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (response.ok) {
      showSuccess("Configuration saved successfully!");
      // Clear repositories to force reload
      repositories = [];
    } else {
      showError(result.error);
    }
  } catch (error) {
    showError("Failed to save configuration: " + error.message);
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
  const hasOrganizedRepos = Object.keys(folderStructure).length > 0;

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
    // Move all organized repos back to unorganized
    Object.keys(folderStructure).forEach((folderPath) => {
      const repos = folderStructure[folderPath];
      repos.forEach((repo) => {
        // Add back to unorganized list if not already there
        if (!unorganizedRepos.includes(repo)) {
          unorganizedRepos.push(repo);
        }
      });
    });

    // Clear the folder structure
    folderStructure = {};

    // Update displays
    updateUnorganizedRepos();
    updateOrganizedStructure();

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
                <p>${repo.description || "No description"}</p>
                <div class="repo-meta">
                    <span class="badge ${repo.private ? "badge-private" : "badge-public"}">
                        ${
                          repo.private
                            ? '<span class="material-icons">lock</span>Private'
                            : '<span class="material-icons">public</span>Public'
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
      results.innerHTML = `
                <div class="success">
                    <h3>Clone Preview</h3>
                    <p>${result.message}</p>
                    <div class="clone-preview-container">
                        ${result.repositories
                          .map(
                            (repo) => `
                            <div class="clone-preview-item">
                                <strong>${repo.name}</strong> ${
                              repo.private
                                ? '<span class="material-icons repo-icon-small">lock</span>'
                                : '<span class="material-icons repo-icon-small">public</span>'
                            }
                                ${repo.language ? `<span class="language-meta"> • ${repo.language}</span>` : ""}
                            </div>
                        `
                          )
                          .join("")}
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

async function startClone() {
  const results = document.getElementById("clone-results");
  results.innerHTML = '<div class="loading">Starting clone process...</div>';

  try {
    const response = await fetch("/api/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: false }),
    });

    const data = await response.json();
    console.log("Clone response:", data);

    if (!response.ok) {
      throw new Error(data.error || "Clone failed");
    }

    // Display results
    let html = `
      <div class="success success-margin">
        <h3>${data.message || "Clone operation completed"}</h3>
        ${
          data.summary
            ? `<p>Total: ${data.summary.total} | Success: ${data.summary.success} | Errors: ${data.summary.errors}</p>`
            : ""
        }
      </div>
    `;

    if (data.results && data.results.length > 0) {
      html += '<div class="clone-results-list">';
      data.results.forEach((result) => {
        const statusClass = result.status === "success" ? "clone-result-success" : "clone-result-error";
        html += `
          <div class="clone-result ${statusClass}">
            <strong>${result.name}</strong>
            <div class="clone-result-message">${result.message}</div>
            ${result.path ? `<div class="clone-result-path">→ ${result.path}</div>` : ""}
          </div>
        `;
      });
      html += "</div>";
    }

    results.innerHTML = html;
  } catch (error) {
    results.innerHTML = `<div class="error">Clone failed: ${error.message}</div>`;
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
    } else {
      showError(result.error);
    }
  } catch (error) {
    console.error("Save organization error:", error);
    showError("Failed to save organization: " + error.message);
  }
}

function initializeOrganizer() {
  displayUnorganizedRepos();
  displayOrganizedStructure();
}

function displayUnorganizedRepos() {
  const container = document.getElementById("unorganized-repos");

  // Clean up existing event listeners to prevent memory leaks
  cleanupEventListeners(container);

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
            <label class="checkbox-label" onclick="event.stopPropagation(); toggleRepoSelection('${
              repo.full_name
            }', event)">
                <input type="checkbox"
                       class="styled-checkbox selection-checkbox"
                       ${selectedRepos.has(repo.full_name) ? "checked" : ""}>
                <span class="checkbox-custom"></span>
            </label>
            <div class="repo-content">
                <div class="repo-name">${repo.full_name}</div>
                <div class="repo-meta">
                    ${
                      repo.private
                        ? '<span class="material-icons repo-icon-small">lock</span>'
                        : '<span class="material-icons repo-icon-small">public</span>'
                    }${repo.language ? ` • ${repo.language}` : ""} • ${formatDate(repo.updated_at)}
                </div>
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
                    <button class="delete-folder-btn" onclick="deleteParentFolder('${parentName}')"><span class="material-icons">delete</span></button>
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
                              <span class="folder-count">${sortedRepos.length}</span>
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
  if (e.target.id === "organized-structure" || e.target.classList.contains("empty-state")) {
    // Create a folder named after the repository itself when dropping on empty space
    reposToMove.forEach((repoName) => {
      const repoFolderName = repoName.split("/").pop(); // Get just the repo name
      const fullPath = repoFolderName; // Use repo name as the folder name in root
      addRepoToFolder(fullPath, repoName);
    });

    // Clear selection if we moved selected repos
    if (reposToMove.some((repo) => selectedRepos.has(repo))) {
      clearSelection();
    }
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
        showSuccess(`Config imported successfully! Loaded ${Object.keys(organizationConfig).length} folders.`);
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
      "Existing organization will be preserved. Continue?"
  );

  if (!confirm) return;

  // Create parent folders based on repository owner
  let organizedCount = 0;
  repositories.forEach((repo) => {
    if (!isRepoOrganized(repo)) {
      const owner = repo.full_name.split("/")[0];
      const repoFolderName = repo.full_name.split("/").pop();
      const fullPath = `${owner}/${repoFolderName}`;
      addRepoToFolder(fullPath, repo.full_name);
      organizedCount++;
    }
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
      "Existing organization will be preserved. Continue?"
  );

  if (!confirm) return;

  // Create folders based on repository language
  let organizedCount = 0;
  repositories.forEach((repo) => {
    if (!isRepoOrganized(repo)) {
      const language = repo.language || "Other";
      const repoFolderName = repo.full_name.split("/").pop();
      const fullPath = `languages/${language.toLowerCase()}/${repoFolderName}`;
      addRepoToFolder(fullPath, repo.full_name);
      organizedCount++;
    }
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
      "Existing organization will be preserved. Continue?"
  );

  if (!confirm) return;

  // Create folders based on repository last updated year
  let organizedCount = 0;
  repositories.forEach((repo) => {
    if (!isRepoOrganized(repo)) {
      const updatedDate = new Date(repo.updated_at);
      const year = updatedDate.getFullYear();
      const repoFolderName = repo.full_name.split("/").pop();
      const fullPath = `by-year/${year}/${repoFolderName}`;
      addRepoToFolder(fullPath, repo.full_name);
      organizedCount++;
    }
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

  // Log memory usage periodically in development
  if (window.location.hostname === "localhost") {
    setInterval(logMemoryUsage, 30000); // Every 30 seconds
  }
});
