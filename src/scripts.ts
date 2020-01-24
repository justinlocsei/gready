import { remove } from 'fs-extra';

import { OperationalError } from './errors';

/**
 * Remove a series of paths
 */
export function removePaths(title: string, paths: string[]): Promise<void> {
  return runAsScript(async function() {
    console.log(title);

    for (const path of paths) {
      console.log(`  ${path}`);
      await remove(path);
    }
  });
}

/**
 * Run a function as a script
 */
export function runAsScript(execute: () => Promise<void>): Promise<void> {
  return execute().catch(function(error) {
    process.exitCode = 1;

    if (error instanceof OperationalError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  });
}
