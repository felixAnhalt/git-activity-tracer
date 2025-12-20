import { getConfigurationFilePathForDisplay, loadConfiguration } from '../../lib/config/index.js';

const JSON_INDENT_SPACES = 2;

/**
 * Handles the --show-config command by displaying configuration
 * file location and current configuration values.
 */
export const handleShowConfigCommand = async (): Promise<void> => {
  const configurationFilePath = getConfigurationFilePathForDisplay();
  console.log(`Configuration file location: ${configurationFilePath}`);

  const configuration = await loadConfiguration();
  console.log('\nCurrent configuration:');
  console.log(JSON.stringify(configuration, null, JSON_INDENT_SPACES));

  console.log('\nTo customize base branches, edit this file with JSON like:');
  console.log(
    JSON.stringify(
      {
        baseBranches: ['main', 'master', 'develop', 'development', 'trunk'],
      },
      null,
      JSON_INDENT_SPACES,
    ),
  );
};
