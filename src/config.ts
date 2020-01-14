import { promisify } from 'util';
import { readFile } from 'fs';

import { Configuration, UserConfiguration } from './types/config';
import { OperationalError } from './errors';
import { validateUserConfiguration } from './validators/config';

const readFileAsync = promisify(readFile);

const ENV_VARS = {
  configPath: 'GREADY_CONFIG',
  goodreadsApiKey: 'GREADY_GOODREADS_API_KEY',
  goodreadsSecret: 'GREADY_GOODREADS_SECRET'
};

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

/**
 * Get the user's Goodreads API key
 */
export function getGoodreadsAPIKey(): string {
  return requireEnvironmentVariable(
    ENV_VARS.goodreadsApiKey,
    'your Goodreads API key'
  );
}

/**
 * Get the user's Goodreads secret
 */
export function getGoodreadsSecret(): string {
  return requireEnvironmentVariable(
    ENV_VARS.goodreadsSecret,
    'your Goodreads secret'
  );
}

/**
 * Get a required value from the environment
 */
function requireEnvironmentVariable(name: string, description: string): string {
  const value = process.env[name];

  if (!value) {
    throw new OperationalError(`You must provide ${description} in the ${name} environment variable`);
  }

  return value;
}
