import yargs from 'yargs';
import { mkdirp } from 'fs-extra';

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
              .option('cache-dir', {
                default: paths.cacheDir,
                describe: 'The directory in which to cache API responses',
                type: 'string'
              });
          },
          async function(args): Promise<void> {
            if (args.h) {
              return Promise.resolve();
            }

            await mkdirp(args['cache-dir']);

            return scrape({
              cacheDir: args['cache-dir'],
              dataDir: args['data-dir']
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

}

/**
 * Run the CLI
 */
export function runCLI(args: string[]): Promise<void> {
  return new CLI(args).run();
}
