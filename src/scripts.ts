import { remove } from 'fs-extra';

import { createStderrWriter, createStdoutWriter, markProcessAsFailed } from './system';
import { OperationalError } from './errors';
import { OutputHandler } from './types/system';

/**
 * Remove a series of paths
 */
export function removePaths(
  title: string,
  paths: string[],
  options: {
    writeToStderr?: OutputHandler;
    writeToStdout?: OutputHandler;
  } = {}
): Promise<void> {
  const writeToStderr = options.writeToStderr || createStderrWriter();
  const writeToStdout = options.writeToStdout || createStdoutWriter();

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
  writeToStderr?: OutputHandler;
} = {}): Promise<void> {
  const writeToStderr = options.writeToStderr || createStderrWriter();

  return execute().catch(function(error) {
    markProcessAsFailed();

    if (error instanceof OperationalError) {
      writeToStderr(error.message);
    } else {
      writeToStderr(error);
    }
  });
}
