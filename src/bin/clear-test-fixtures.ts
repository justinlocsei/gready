import { paths } from '../environment';
import { removePaths } from '../scripts';

export function run(): Promise<void> {
  return removePaths('Clear test fixtures', [
    paths.apiFixturesDir,
    paths.networkFixturesDir
  ]);
}

if (require.main === module) {
  run();
}
