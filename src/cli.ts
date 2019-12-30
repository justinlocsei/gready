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
      const parser = yargs
        .option('data-dir', {
          default: paths.dataDir,
          describe: 'The directory in which to store processed data',
          type: 'string'
        })
        .option('h', {
          alias: 'help',
          describe: 'Show usage',
          type: 'boolean'
        })
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
            if (args.h) {
              return Promise.resolve();
            }

            const dirs = await this.initializeDataDirectory(args['data-dir']);

            const client = new APIClient({
              authDir: dirs.authDir,
              cacheDir: dirs.cacheDir,
              useCache: args['cache']
            });

            return scrape({
              client,
              dataDir: dirs.rootDir
            });
          }
        )
        .demandCommand(1, 'You must select a mode of operation')
        .strict()
        .help(false);

      const options = parser.parse(this.args.slice(1));

      if (options.h) {
        parser.showHelp();
        resolve();
      }
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
