import path from 'path';
import process from 'process';

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
    dataDir: path.join(rootDir, 'data'),
    rootDir
  };
}

export const paths = resolvePaths();
