import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface Configuration {
  baseBranches: string[];
}

const DEFAULT_CONFIGURATION: Configuration = {
  baseBranches: ['main', 'master', 'develop', 'development'],
};

const CONFIG_DIRECTORY_NAME = '.git-activity-tracer';
const CONFIG_FILE_NAME = 'config.json';

/**
 * Gets the configuration directory path.
 * Cross-platform: uses home directory on all systems.
 */
const getConfigurationDirectoryPath = (): string => {
  return path.join(os.homedir(), CONFIG_DIRECTORY_NAME);
};

/**
 * Gets the configuration file path.
 */
const getConfigurationFilePath = (): string => {
  return path.join(getConfigurationDirectoryPath(), CONFIG_FILE_NAME);
};

/**
 * Ensures the configuration directory exists.
 */
const ensureConfigurationDirectory = async (): Promise<void> => {
  const directoryPath = getConfigurationDirectoryPath();
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
};

/**
 * Loads configuration from file or returns defaults.
 * If the file doesn't exist, creates it with default values.
 */
export const loadConfiguration = async (): Promise<Configuration> => {
  const filePath = getConfigurationFilePath();

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<Configuration>;

    // Merge with defaults to handle missing fields
    return {
      ...DEFAULT_CONFIGURATION,
      ...parsed,
    };
  } catch (error) {
    // If file doesn't exist, create it with defaults
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      await saveConfiguration(DEFAULT_CONFIGURATION);
      return DEFAULT_CONFIGURATION;
    }

    // For other errors (invalid JSON, etc.), log warning and return defaults
    console.warn(
      `Warning: Failed to load configuration from ${filePath}. Using defaults. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return DEFAULT_CONFIGURATION;
  }
};

/**
 * Saves configuration to file.
 */
export const saveConfiguration = async (configuration: Configuration): Promise<void> => {
  await ensureConfigurationDirectory();
  const filePath = getConfigurationFilePath();
  const content = JSON.stringify(configuration, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
};

/**
 * Gets the configuration file path for display purposes.
 */
export const getConfigurationFilePathForDisplay = (): string => {
  return getConfigurationFilePath();
};
