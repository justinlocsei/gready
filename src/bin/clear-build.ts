import { paths } from '../environment';
import { removePaths } from '../scripts';

export function run(): Promise<void> {
  return removePaths('Clear build directories', [
    paths.distDir,
    paths.validatorsDir
  ]);
}

if (require.main === module) {
  run();
}
