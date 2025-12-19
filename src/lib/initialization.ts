import { createGitHubConnector } from '../connectors/github.js';
import { createGitLabConnector } from '../connectors/gitlab.js';
import { loadConfiguration } from '../configuration.js';
import type { Connector } from '../connectors/types.js';
import type { Configuration } from '../configuration.js';

/**
 * Attempts to create a GitHub connector if GH_TOKEN is available.
 * @returns GitHub connector or null if token not available
 */
const createGitHubConnectorIfAvailable = (configuration: Configuration): Connector | null => {
  const token = process.env.GH_TOKEN;
  if (!token || token.trim() === '') {
    return null;
  }

  try {
    return createGitHubConnector(token, configuration);
  } catch (error) {
    console.warn(
      `Warning: Failed to initialize GitHub connector: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
};

/**
 * Attempts to create a GitLab connector if GITLAB_TOKEN is available.
 * @returns GitLab connector or null if token not available
 */
const createGitLabConnectorIfAvailable = (configuration: Configuration): Connector | null => {
  const token = process.env.GITLAB_TOKEN;
  if (!token || token.trim() === '') {
    return null;
  }

  try {
    return createGitLabConnector(token, configuration);
  } catch (error) {
    console.warn(
      `Warning: Failed to initialize GitLab connector: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
};

/**
 * Loads application configuration and initializes all available connectors.
 * Automatically detects which platforms to use based on available tokens:
 * - GH_TOKEN → GitHub
 * - GITLAB_TOKEN → GitLab
 *
 * @returns Array of initialized connectors (may be empty if no tokens available)
 */
export const initializeConnectors = async (): Promise<Connector[]> => {
  try {
    const configuration = await loadConfiguration();
    const connectors: Connector[] = [];

    // Try to initialize GitHub connector
    const githubConnector = createGitHubConnectorIfAvailable(configuration);
    if (githubConnector) {
      connectors.push(githubConnector);
    }

    // Try to initialize GitLab connector
    const gitlabConnector = createGitLabConnectorIfAvailable(configuration);
    if (gitlabConnector) {
      connectors.push(gitlabConnector);
    }

    if (connectors.length === 0) {
      throw new Error(
        'No connectors available. Please provide at least one token: GH_TOKEN or GITLAB_TOKEN',
      );
    }

    return connectors;
  } catch (error) {
    throw new Error(
      `Failed to initialize connectors: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
