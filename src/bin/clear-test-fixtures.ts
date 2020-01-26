import { paths } from '../environment';
import { removePaths } from '../scripts';

removePaths(
  'Clear test fixtures',
  [
    paths.apiFixturesDir,
    paths.networkFixturesDir
  ],
  {
    stderr: process.stderr,
    stdout: process.stdout
  }
);
