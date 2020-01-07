import path from 'path';
import process from 'process';
import { mkdirp } from 'fs-extra';

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
    sessionFile: path.join(rootDir, '.session.json'),
    rootDir
  };
}

export const paths = resolvePaths();
