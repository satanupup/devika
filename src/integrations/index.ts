/**
 * @module Integrations
 * This module provides integration with third-party tools like GitHub, Jira, etc.
 * It follows a barrel file pattern, exporting all necessary components from this directory.
 */

// Core Engine
export * from './IntegrationEngine';

// Manager
export * from './IntegrationManager';

// Command Provider
export * from './IntegrationCommandProvider';

// System Initialization and Status
export * from './system';

// Event System
export * from './events';

// Utility Functions
export * from './utils';

// --- Concrete Integration Providers ---

// GitHub
export * from './providers/GitHubIntegration';

// Jira
export * from './providers/JiraIntegration';

// Confluence
export * from './providers/ConfluenceIntegration';
