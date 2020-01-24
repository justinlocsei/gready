import { remove } from 'fs-extra';

import { paths } from '../environment';

const FIXTURE_DIRS = [
  paths.apiFixturesDir,
  paths.networkFixturesDir
];

/**
 * Clear test fixtures
 */
async function clearTestFixtures(): Promise<void> {
  console.log('Clear test fixtures');

  for (const fixtureDir of FIXTURE_DIRS.sort()) {
    console.log(`  ${fixtureDir}`);
    await remove(fixtureDir);
  }
}

clearTestFixtures().catch(function(error) {
  process.exitCode = 1;
  console.error(error);
});
