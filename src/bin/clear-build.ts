import { paths } from '../environment';
import { removePaths } from '../scripts';

removePaths('Clear build directories', [
  paths.distDir,
  paths.validatorsDir
]);
