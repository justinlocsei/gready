import fs from 'graceful-fs';
import { promisify } from 'util';
import { readFile } from 'fs';

import { Configuration, UserConfiguration } from './types/config';
import { OperationalError } from './errors';
import { validateUserConfiguration } from './validators/config';

const readFileAsync = promisify(readFile);
const statAsync = promisify(fs.stat);

const DEFAULT_CONFIG: Configuration = {
  ignoreShelves: [],
  mergePublishers: {},
  mergeShelves: {}
};

const ENV_VARS = {
  goodreadsAPIKey: 'GREADY_GOODREADS_API_KEY',
  goodreadsUserID: 'GREADY_GOODREADS_USER_ID'
};

/**
 * Load a configuration
 */
export async function loadConfig(
  configPath: string,
  options: { allowMissing?: boolean; } = {}
): Promise<Configuration> {
  if (options.allowMissing) {
    try {
      await statAsync(configPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return DEFAULT_CONFIG;
      } else {
        throw error;
      }
    }
  }

  return loadConfigFile(configPath);
}

/**
 * Attempt to load a config file at a given path
 */
async function loadConfigFile(filePath: string): Promise<Configuration> {
  let text: string;
  let data: object;
  let config: UserConfiguration;

  try {
    text = await readFileAsync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new OperationalError(`No config file found at path: ${filePath}`);
    } else {
      throw error;
    }
  }

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new OperationalError(`Invalid JSON found in configuration: ${filePath}\n--\n${error}`);
  }

  try {
    config = validateUserConfiguration(data);
  } catch (error) {
    throw new OperationalError(`Invalid configuration: ${filePath}\n--\n${error}`);
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
    ENV_VARS.goodreadsAPIKey,
    'your Goodreads API key'
  );
}

/**
 * Get the user's Goodreads user ID
 */
export function getGoodreadsUserID(): string {
  return requireEnvironmentVariable(
    ENV_VARS.goodreadsUserID,
    'your Goodreads user ID'
  );
}

/**
 * Whether a Goodreads API key has been set
 */
export function hasGoodreadsAPIKey(): boolean {
  return !!process.env[ENV_VARS.goodreadsAPIKey];
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
