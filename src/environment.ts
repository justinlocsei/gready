import path from 'path';
import process from 'process';
import { mkdirp } from 'fs-extra';

export interface OutputDirectoryStructure {
  authDir: string;
  cacheDir: string;
  dataDir: string;
}

/**
 * Create all required directories within an output directory
 */
export async function prepareOutputDirectory(rootPath: string): Promise<OutputDirectoryStructure> {
  await mkdirp(rootPath);

  const authDir = path.join(rootPath, 'auth');
  const cacheDir = path.join(rootPath, '.cache');
  const dataDir = path.join(rootPath, 'data');

  await mkdirp(authDir);
  await mkdirp(cacheDir);
  await mkdirp(dataDir);

  return {
    authDir,
    cacheDir,
    dataDir
  };
}

/**
 * Read a secret from the environment
 */
export function readSecret(varName: string): string {
  const value = process.env[varName];

  if (!value) {
    throw new Error(`Secret not found in environment: ${varName}`);
  }

  return value;
}

/**
 * Provide information on used paths
 */
function resolvePaths() {
  const rootDir = path.normalize(path.join(__dirname, '..'));

  return {
    outputDir: path.join(rootDir, 'output'),
    rootDir
  };
}

export const paths = resolvePaths();
