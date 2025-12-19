import { loadConfiguration, saveConfiguration } from '../../configuration.js';

/**
 * Parses the project-id command arguments.
 * Expected formats:
 * - list → list all mappings
 * - add repo-name project-id → add mapping
 * - remove repo-name → remove mapping
 */
const parseProjectIdArguments = (
  argumentsList: string[],
): { action: 'list' | 'add' | 'remove'; repository?: string; projectId?: string } => {
  if (argumentsList.length === 0) {
    throw new Error(
      'Usage: --project-id <action> [args]\nActions:\n  list\n  add <repository> <projectId>\n  remove <repository>',
    );
  }

  const action = argumentsList[0];

  if (action === 'list') {
    return { action: 'list' };
  }

  if (action === 'add') {
    if (argumentsList.length < 3) {
      throw new Error('Usage: --project-id add <repository> <projectId>');
    }
    return { action: 'add', repository: argumentsList[1], projectId: argumentsList[2] };
  }

  if (action === 'remove') {
    if (argumentsList.length < 2) {
      throw new Error('Usage: --project-id remove <repository>');
    }
    return { action: 'remove', repository: argumentsList[1] };
  }

  throw new Error(`Unknown project-id action: ${action}. Valid actions: list, add, remove`);
};

/**
 * Lists all repository project ID mappings.
 */
const handleListAction = async (): Promise<void> => {
  const configuration = await loadConfiguration();
  const mappings = configuration.repositoryProjectIds ?? {};

  if (Object.keys(mappings).length === 0) {
    console.log('No repository project ID mappings configured.');
    return;
  }

  console.log('Repository Project ID Mappings:');
  for (const [repository, projectId] of Object.entries(mappings)) {
    console.log(`  ${repository} → ${projectId}`);
  }
};

/**
 * Adds a repository project ID mapping.
 */
const handleAddAction = async (repository: string, projectId: string): Promise<void> => {
  const configuration = await loadConfiguration();
  const mappings = configuration.repositoryProjectIds ?? {};

  if (mappings[repository]) {
    console.log(
      `Warning: Overwriting existing mapping for ${repository}: ${mappings[repository]} → ${projectId}`,
    );
  }

  mappings[repository] = projectId;
  configuration.repositoryProjectIds = mappings;

  await saveConfiguration(configuration);
  console.log(`✓ Added mapping: ${repository} → ${projectId}`);
};

/**
 * Removes a repository project ID mapping.
 */
const handleRemoveAction = async (repository: string): Promise<void> => {
  const configuration = await loadConfiguration();
  const mappings = configuration.repositoryProjectIds ?? {};

  if (!mappings[repository]) {
    console.log(`No mapping found for repository: ${repository}`);
    return;
  }

  const removedProjectId = mappings[repository];
  delete mappings[repository];
  configuration.repositoryProjectIds = mappings;

  await saveConfiguration(configuration);
  console.log(`✓ Removed mapping: ${repository} (was ${removedProjectId})`);
};

/**
 * Handles the --project-id command by managing repository project ID mappings.
 * Supports three actions:
 * - list: Display all current mappings
 * - add <repository> <projectId>: Add or update a mapping
 * - remove <repository>: Remove a mapping
 */
export const handleProjectIdCommand = async (argumentsList: string[]): Promise<void> => {
  try {
    const { action, repository, projectId } = parseProjectIdArguments(argumentsList);

    switch (action) {
      case 'list':
        await handleListAction();
        break;
      case 'add':
        if (!repository || !projectId) {
          throw new Error('Repository and projectId are required for add action');
        }
        await handleAddAction(repository, projectId);
        break;
      case 'remove':
        if (!repository) {
          throw new Error('Repository is required for remove action');
        }
        await handleRemoveAction(repository);
        break;
    }
  } catch (error) {
    console.error(
      'Error managing project IDs:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
};
