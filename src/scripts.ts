import { remove } from 'fs-extra';

import { markProcessAsFailed } from './system';
import { OperationalError } from './errors';
import { OutputHandler } from './types/system';

/**
 * Remove a series of paths
 */
export function removePaths(
  title: string,
  paths: string[],
  options: {
    writeToStderr: OutputHandler;
    writeToStdout: OutputHandler;
  }
): Promise<void> {
  const { writeToStderr, writeToStdout } = options;

  return runAsScript(async function() {
    writeToStdout(title);

    for (const path of paths) {
      writeToStdout(`  ${path}`);
      await remove(path);
    }
  }, { writeToStderr });
}

/**
 * Run a function as a script
 */
export function runAsScript(execute: () => Promise<void>, options: {
  writeToStderr: OutputHandler;
}): Promise<void> {
  const { writeToStderr } = options;

  return execute().catch(function(error) {
    markProcessAsFailed();

    if (error instanceof OperationalError) {
      writeToStderr(error.message);
    } else {
      writeToStderr(error);
    }
  });
}
