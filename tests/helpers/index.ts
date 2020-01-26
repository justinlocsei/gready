import tmp from 'tmp';

import Cache from '../../src/cache';
import Logger, { Options as LoggerOptions } from '../../src/logger';
import { buildConfig } from '../../src/config';
import { Configuration, UserConfiguration } from '../../src/types/config';
import { OutputHandler } from '../../src/types/system';

type OutputReader = () => string[];

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
  return new Cache(
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
 * Create an output handler and a function that reads its messages
 */
export function createOutputHandler(): [OutputHandler, OutputReader] {
  const messages: string[] = [];

  function handleMessage(message: string) {
    messages.push(message.toString());
  }

  return [
    handleMessage,
    () => messages
  ];
}

/**
 * Create a logger for use in testing and a function to read its output
 */
export function createTestLogger(options?: LoggerOptions): [Logger, OutputReader] {
  const [handleMessage, readOutput] = createOutputHandler();

  return [
    new Logger(handleMessage, { useColor: false, ...options }),
    readOutput
  ];
}
