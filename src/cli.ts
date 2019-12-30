import yargs from 'yargs';

import APIClient from './api-client';
import { OutputDirectoryStructure, paths, prepareOutputDirectory } from './environment';
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
        .option('output-dir', {
          default: paths.outputDir,
          describe: 'The directory in which to store generated files',
          type: 'string'
        })
        .command(
          'clear-cache',
          'Clear all cached data',
          y => y,
          async (args): Promise<void> => {
            const [client] = await this.createAPIClient({
              outputDir: args['output-dir'],
              useCache: false
            });

            return client.clearCache();
          }
        )
        .command(
          'log-in',
          'Allow gready to access your Goodreads account',
          y => y,
          async (args): Promise<void> => {
            const [client] = await this.createAPIClient({
              outputDir: args['output-dir'],
              useCache: false
            });

            const userID = await client.logIn();

            console.log(`Logged in with user ID: ${userID}`);
          }
        )
        .command(
          'log-out',
          'Prevent gready from accessing your Goodreads account',
          y => y,
          async (args): Promise<void> => {
            const [client] = await this.createAPIClient({
              outputDir: args['output-dir'],
              useCache: false
            });

            return client.logOut();
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
            const [client, dirs] = await this.createAPIClient({
              outputDir: args['output-dir'],
              useCache: args['cache']
            });

            return scrape({
              client,
              dataDir: dirs.dataDir
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
    outputDir,
    useCache
  }: {
    outputDir: string;
    useCache: boolean;
  }): Promise<[APIClient, OutputDirectoryStructure]> {
    const dirs = await prepareOutputDirectory(outputDir);

    const client = new APIClient({
      cacheDir: dirs.cacheDir,
      sessionFile: paths.sessionFile,
      useCache
    });

    return [client, dirs];
  }

}

/**
 * Run the CLI
 */
export function runCLI(args: string[]): Promise<void> {
  return new CLI(args).run();
}
