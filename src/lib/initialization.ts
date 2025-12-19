import { createGitHubConnector } from '../connectors/github.js';
import { loadConfiguration } from '../configuration.js';

/**
 * Loads application configuration and initializes the GitHub connector.
 *
 * @returns Initialized connector ready to fetch contributions
 */
export const initializeConnector = async () => {
  try {
    const githubToken = process.env.GH_TOKEN;
    if (!githubToken) {
      throw new Error(
        'GH_TOKEN environment variable is not set. Please provide a GitHub personal access token.',
      );
    }

    const configuration = await loadConfiguration();
    return createGitHubConnector(githubToken, configuration);
  } catch (error) {
    throw new Error(
      `Failed to initialize connector: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
