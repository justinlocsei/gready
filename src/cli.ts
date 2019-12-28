import commander from 'commander';
import { mkdirp } from 'fs-extra';

import APIClient from './api-client';
import { paths } from './environment';

interface CLIOptions {

}

class CLI {

  private options: CLIOptions;

  /**
   * Create a new CLI
   */
  constructor(args: string[]) {
    this.options = this.parseArgs(args);
  }

  /**
   * Run the CLI
   */
  async run(): Promise<void> {
    await mkdirp(paths.cacheDir);

    const client = new APIClient({
      cacheDir: paths.cacheDir
    });
  }

  /**
   * Convert command-line arguments to options
   */
  private parseArgs(args: string[]): CLIOptions {
    return {};
  }

}

/**
 * Run the CLI
 */
export function runCLI(args: string[]): Promise<void> {
  return new CLI(args).run();
}
