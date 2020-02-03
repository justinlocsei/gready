import tmp from 'tmp';
import { flatten } from 'lodash';

import { buildConfig } from '../../src/config';
import { Cache, createCache } from '../../src/cache';
import { Configuration, UserConfiguration } from '../../src/types/config';
import { createAPIClient } from '../../src/api-client';
import { createLogger, Logger, LoggerOptions } from '../../src/logger';
import { createRepository, Repository } from '../../src/repository';
import { OutputHandler } from '../../src/types/system';

export type OutputReader = () => string[];

/**
 * Whether tests can attempt network access
 */
export function canAttemptNetworkAccess(): boolean {
  return canUpdateFixtures() || shouldBypassFixtures();
}

/**
 * Whether test fixtures can be updated
 */
export function canUpdateFixtures(): boolean {
  return process.env['GREADY_ALLOW_TEST_FIXTURE_UPDATES'] === '1';
}

/**
 * Whether tests should bypass fixtures
 */
export function shouldBypassFixtures(): boolean {
  return process.env['GREADY_BYPASS_TEST_FIXTURES'] === '1';
}

/**
 * Create a pass-through cache for testing
 */
export function createTestCache(): Cache {
  return createCache(
    tmp.dirSync().name,
    { enabled: false }
  );
}

/**
 * Create a configuration for testing
 */
export function createTestConfig(data?: UserConfiguration): Configuration {
  return buildConfig(data);
}

/**
 * Create a repository for testing
 */
export function createTestRepo(options: {
  cache?: Cache;
  config?: UserConfiguration;
} = {}): Repository {
  const [logger] = createTestLogger();

  const apiClient = createAPIClient({
    apiKey: 'testing',
    cache: createTestCache(),
    logger
  });

  return createRepository({
    apiClient,
    cache: options.cache || createTestCache(),
    config: createTestConfig(options.config),
    logger
  });
}

/**
 * Create an output handler and a function that reads its messages
 */
export function createOutputHandler(): [OutputHandler, OutputReader] {
  const messages: string[] = [];

  function handleMessage(message: string) {
    messages.push(message.toString());
  }

  return [
    handleMessage,
    () => flatten(messages.map(m => m.split('\n')))
  ];
}

/**
 * Create a logger for use in testing and a function to read its output
 */
export function createTestLogger(options?: LoggerOptions): [Logger, OutputReader] {
  const [handleMessage, readOutput] = createOutputHandler();

  return [
    createLogger(handleMessage, { useColor: false, ...options }),
    readOutput
  ];
}
