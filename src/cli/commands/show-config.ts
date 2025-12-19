import { getConfigurationFilePathForDisplay } from '../../configuration.js';

const JSON_INDENT_SPACES = 2;

/**
 * Handles the --show-config command by displaying configuration
 * file location and usage instructions.
 */
export const handleShowConfigCommand = (): void => {
  const configurationFilePath = getConfigurationFilePathForDisplay();
  console.log(`Configuration file location: ${configurationFilePath}`);
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
