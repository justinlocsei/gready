import { remove } from 'fs-extra';

import { paths } from '../environment';

const BUILD_DIRS = [
  paths.distDir,
  paths.validatorsDir
];

/**
 * Clear build directories
 */
async function clearBuild(): Promise<void> {
  console.log('Clear build directories');

  for (const buildDir of BUILD_DIRS.sort()) {
    console.log(`  ${buildDir}`);
    await remove(buildDir);
  }
}

clearBuild().catch(function(error) {
  process.exitCode = 1;
  console.error(error);
});
