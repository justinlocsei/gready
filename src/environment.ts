import path from 'path';
import process from 'process';
import { mkdirp } from 'fs-extra';

import { OperationalError } from './errors';

export interface OutputDirectoryStructure {
  apiRequestsDir: string;
  dataDir: string;
}

/**
 * Create all required directories within an output directory
 */
export async function prepareOutputDirectory(rootPath: string): Promise<OutputDirectoryStructure> {
  await mkdirp(rootPath);

  const apiRequestsDir = path.join(rootPath, 'api-requests');
  const dataDir = path.join(rootPath, 'data');

  await mkdirp(apiRequestsDir);
  await mkdirp(dataDir);

  return {
    apiRequestsDir,
    dataDir
  };
}

/**
 * Read a secret from the environment
 */
export function readSecret(varName: string): string {
  const value = process.env[varName];

  if (!value) {
    throw new OperationalError(`Secret not found in environment: ${varName}`);
  }

  return value;
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

  return {
    outputDir: path.join(rootDir, 'output'),
    sessionFile: path.join(rootDir, '.session.json'),
    srcDir,
    typesDir: path.join(srcDir, 'types'),
    rootDir,
    validatorsDir: path.join(srcDir, 'validators')
  };
}

export const paths = resolvePaths();
