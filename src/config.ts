import { promisify } from 'util';
import { readFile } from 'fs';

import { Configuration, UserConfiguration } from './types/config';
import { OperationalError } from './errors';
import { validateUserConfiguration } from './validators/config';

const readFileAsync = promisify(readFile);

const DEFAULT_CONFIG: Configuration = {
  ignoreShelves: [],
  mergePublishers: {},
  mergeShelves: {}
};

/**
 * Load a configuration
 */
export async function loadConfig(configPath?: string): Promise<Configuration> {
  if (!configPath) {
    return DEFAULT_CONFIG;
  }

  let configText: string;
  let configData: object;
  let config: UserConfiguration;

  try {
    configText = await readFileAsync(configPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new OperationalError(`No config file found at path: ${configPath}`);
    } else {
      throw error;
    }
  }

  try {
    configData = JSON.parse(configText);
  } catch (error) {
    throw new OperationalError(`Invalid JSON found in configuration: ${configPath}\n--\n${error}`);
  }

  try {
    config = validateUserConfiguration(configData);
  } catch (error) {
    throw new OperationalError(`Invalid configuration: ${configPath}\n--\n${error}`);
  }

  return {
    ...DEFAULT_CONFIG,
    ...config
  };
}
