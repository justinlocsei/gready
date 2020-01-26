import fs from 'graceful-fs';
import tmp from 'tmp';
import { promisify } from 'util';

import Cache from '../../src/cache';
import Logger, { Options as LoggerOptions } from '../../src/logger';
import { buildConfig } from '../../src/config';
import { Configuration, UserConfiguration } from '../../src/types/config';

const readFileAsync = promisify(fs.readFile);

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
 * Create a logger for use in testing and a function to read its output
 */
export function createTestLogger(options?: LoggerOptions): [Logger, () => Promise<string[]>] {
  const file = tmp.fileSync();
  const stream = fs.createWriteStream(file.name);

  function closeStream() {
    return new Promise(function(resolve, reject) {
      stream.on('error', reject);
      stream.on('finish', resolve);

      stream.end();
    });
  }

  async function readLog() {
    await closeStream();
    const lines = await readFileAsync(file.name, 'utf8');

    return lines.split('\n').slice(0, -1);
  }

  return [
    new Logger(stream, { useColor: false, ...options }),
    readLog
  ];
}
