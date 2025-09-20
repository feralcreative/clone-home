#!/usr/bin/env node

/**
 * Clone Home - Main Entry Point
 * 
 * This is the main entry point for the Clone Home application.
 * It exports the core classes and provides a simple programmatic interface.
 */

export { CloneHome } from './clone-home.js';
export { Config } from './config.js';
export { RepositoryOrganizer } from './organizer.js';
export { WebUI } from './web-ui.js';

// If this file is run directly, start the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  // Import and run the CLI
  const { default: cli } = await import('./cli.js');
}
