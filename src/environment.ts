import os from 'os';
import path from 'path';
import { chmod } from 'graceful-fs';
import { mkdirp } from 'fs-extra';
import { promisify } from 'util';

const chmodAsync = promisify(chmod);

interface DataDirectoryStructure {
  cacheDirs: {
    apiRequests: string;
    data: string;
  };
}

/**
 * Extract command-line arguments from a list
 */
export function extractArgs(args: string[]): string[] {
  const binPosition = args.findIndex(a => a.match(/[\\\/]node$/));
  const argsStart = binPosition >= 0 ? binPosition + 2 : 0;

  return args.slice(argsStart);
}

/**
 * Create all required directories within a data directory
 */
export async function prepareDataDirectory(rootDir: string): Promise<DataDirectoryStructure> {
  await mkdirp(rootDir);
  await chmodAsync(rootDir, 0o700);

  const cacheDir = path.join(rootDir, 'cache');
  const apiRequestsDir = path.join(cacheDir, 'api-requests');
  const dataDir = path.join(cacheDir, 'data');

  await mkdirp(apiRequestsDir);
  await mkdirp(dataDir);

  return {
    cacheDirs: {
      apiRequests: apiRequestsDir,
      data: dataDir
    }
  };
}

/**
 * Determine the path to require a source file from a relative directory
 */
export function resolveRequire(
  rootDir: string,
  filePath: string,
  extension?: string
): string {
  const relative = path.relative(rootDir, filePath);
  const requirePath = relative.match(/^\w/) ? `./${relative}` : relative;

  return extension
    ? requirePath.replace(new RegExp(`${extension}$`), '')
    : requirePath;
}

/**
 * Provide information on used paths
 */
function resolvePaths() {
  const rootDir = path.normalize(path.join(__dirname, '..'));
  const srcDir = path.join(rootDir, 'src');
  const testsDir = path.join(rootDir, 'tests');

  return {
    defaultConfig: path.join(os.homedir(), '.greadyrc'),
    distDir: path.join(rootDir, 'dist'),
    rootDir,
    srcDir,
    testFixturesDir: path.join(testsDir, 'fixtures'),
    testsDir,
    typesDir: path.join(srcDir, 'types'),
    validatorsDir: path.join(srcDir, 'validators')
  };
}

export const paths = resolvePaths();
