import fs from 'fs-extra';
import os from 'os';
import path from 'path';

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
  const binPosition = args.findIndex(function(arg) {
    const basenames = [
      path.posix.basename(arg),
      path.win32.basename(arg)
    ];

    return basenames.some(n => n.match(/^node(\.exe)?$/));
  });

  return args.slice(binPosition >= 0 ? binPosition + 2 : 0);
}

/**
 * Create all required directories within a data directory
 */
export async function prepareDataDirectory(rootDir: string): Promise<DataDirectoryStructure> {
  await fs.mkdirp(rootDir);
  await fs.chmod(rootDir, 0o700);

  const cacheDir = path.join(rootDir, 'cache');
  const apiRequestsDir = path.join(cacheDir, 'api-requests');
  const dataDir = path.join(cacheDir, 'data');

  await fs.mkdirp(apiRequestsDir);
  await fs.mkdirp(dataDir);

  return {
    cacheDirs: {
      apiRequests: apiRequestsDir,
      data: dataDir
    }
  };
}

/**
 * Provide information on used paths
 */
function resolvePaths() {
  const rootDir = path.normalize(path.join(__dirname, '..'));
  const srcDir = path.join(rootDir, 'src');
  const testsDir = path.join(rootDir, 'tests');
  const testFixturesDir = path.join(testsDir, 'fixtures');

  return {
    apiFixturesDir: path.join(testFixturesDir, 'api'),
    defaultConfig: path.join(os.homedir(), '.greadyrc'),
    distDir: path.join(rootDir, 'dist'),
    gitignore: path.join(rootDir, '.gitignore'),
    networkFixturesDir: path.join(testFixturesDir, 'network'),
    rootDir,
    srcDir,
    testsDir,
    testFixturesDir,
    typesDir: path.join(srcDir, 'types'),
    validatorsDir: path.join(srcDir, 'validators'),
    validationFile: path.join(srcDir, 'validation.ts')
  };
}

export const paths = resolvePaths();
