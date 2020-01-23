import fs from 'graceful-fs';
import tmp from 'tmp';
import { promisify } from 'util';

import Logger, { Options as LoggerOptions } from '../../src/logger';

const readFileAsync = promisify(fs.readFile);

/**
 * Whether test fixtures should be refreshed
 */
export function shouldRefreshFixtures(): boolean {
  return process.env['GREADY_REFRESH_FIXTURES'] === '1';
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
