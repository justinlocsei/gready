import { remove } from 'fs-extra';

import { OperationalError } from './errors';

/**
 * Remove a series of paths
 */
export function removePaths(
  title: string,
  paths: string[],
  {
    stderr,
    stdout
  }: {
    stderr: NodeJS.WritableStream;
    stdout: NodeJS.WritableStream;
  }
): Promise<void> {
  return runAsScript(async function() {
    stdout.write(title + '\n');

    for (const path of paths) {
      stdout.write(`  ${path}\n`);
      await remove(path);
    }
  }, { stderr });
}

/**
 * Run a function as a script
 */
export function runAsScript(execute: () => Promise<void>, {
  stderr
}: {
  stderr: NodeJS.WritableStream;
}): Promise<void> {
  return execute().catch(function(error) {
    process.exitCode = 1;

    if (error instanceof OperationalError) {
      stderr.write(error.message + '\n');
    } else {
      stderr.write(error + '\n');
    }
  });
}
