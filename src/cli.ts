import path from 'path';
import yargs from 'yargs';
import { mkdirp } from 'fs-extra';

import APIClient from './api-client';
import { paths } from './environment';
import { scrape } from './tasks/scrape';

class CLI {

  private args: string[];

  /**
   * Create a new CLI
   */
  constructor(args: string[]) {
    this.args = args;
  }

  /**
   * Run the CLI
   */
  run(): Promise<void> {
    return new Promise((resolve, reject) => {
      yargs
        .option('data-dir', {
          default: paths.dataDir,
          describe: 'The directory in which to store processed data',
          type: 'string'
        })
        .command(
          'clear-cache',
          'Clear all cached data',
          y => y,
          async (args): Promise<void> => {
            const client = await this.createAPIClient({
              dataDir: args['data-dir'],
              useCache: false
            });

            return client.clearCache();
          }
        )
        .command(
          'scrape',
          'Scrape data from Goodreads',
          function(y) {
            return y
              .option('cache', {
                default: true,
                describe: 'Cache API responses',
                type: 'boolean'
              });
          },
          async (args): Promise<void> => {
            const client = await this.createAPIClient({
              dataDir: args['data-dir'],
              useCache: args['cache']
            });

            return scrape({
              client,
              dataDir: args['data-dir']
            });
          }
        )
        .demandCommand(1, 'You must select a mode of operation')
        .strict()
        .help('h')
        .alias('h', 'help')
        .version()
        .parse(this.args.slice(1));
    });
  }

  /**
   * Create an API client
   */
  private async createAPIClient({
    dataDir,
    useCache
  }: {
    dataDir: string;
    useCache: boolean;
  }): Promise<APIClient> {
    const dirs = await this.initializeDataDirectory(dataDir);

    return new APIClient({
      authDir: dirs.authDir,
      cacheDir: dirs.cacheDir,
      useCache
    });
  }

  /**
   * Create a data directory's structure
   */
  private async initializeDataDirectory(rootPath: string): Promise<{
    authDir: string;
    cacheDir: string;
    rootDir: string;
  }> {
    const authDir = path.join(rootPath, 'auth');
    const cacheDir = path.join(rootPath, '.cache');

    await mkdirp(rootPath);
    await mkdirp(authDir);
    await mkdirp(cacheDir);

    return {
      authDir,
      cacheDir,
      rootDir: rootPath
    };
  }

}

/**
 * Run the CLI
 */
export function runCLI(args: string[]): Promise<void> {
  return new CLI(args).run();
}
