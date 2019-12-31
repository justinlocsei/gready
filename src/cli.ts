import yargs from 'yargs';

import APIClient from './api-client';
import Logger, { Levels, LevelName, LEVEL_NAMES, NAMED_LEVELS } from './logger';
import { OutputDirectoryStructure, paths, prepareOutputDirectory } from './environment';
import { scrape } from './tasks/scrape';

interface CLIOPtions {
  args: string[];
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
}

interface ParsedOptions {
  color: boolean;
  cache?: boolean;
  'log-level': LevelName;
  'output-dir': string;
}

class CLI {

  private options: CLIOPtions;

  /**
   * Create a new CLI
   */
  constructor(options: CLIOPtions) {
    this.options = options;
  }

  /**
   * Run the CLI
   */
  run(): Promise<void> {
    return new Promise((resolve, reject) => {
      yargs
        .option('color', {
          default: true,
          describe: 'Use colored output',
          type: 'boolean'
        })
        .option('log-level', {
          choices: Object.keys(NAMED_LEVELS),
          default: LEVEL_NAMES[Levels.Info],
          describe: 'The log level to use',
          type: 'string'
        })
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
            const [client] = await this.createAPIClient(args);
            return client.clearCache();
          }
        )
        .command(
          'log-in',
          'Allow gready to access your Goodreads account',
          y => y,
          async (args): Promise<void> => {
            const [client] = await this.createAPIClient(args);
            const userID = await client.logIn();

            const logger = this.createLogger(args);
            logger.info(`Logged in with user ID: ${userID}`);
          }
        )
        .command(
          'log-out',
          'Prevent gready from accessing your Goodreads account',
          y => y,
          async (args): Promise<void> => {
            const [client] = await this.createAPIClient(args);
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
            const [client, dirs] = await this.createAPIClient(args);

            return scrape({
              client,
              dataDir: dirs.dataDir
            }).catch(function(error) {
              process.exitCode = 1;
              console.error(error);
            });
          }
        )
        .demandCommand(1, 'You must select a mode of operation')
        .strict()
        .help('h')
        .alias('h', 'help')
        .version()
        .parse(this.options.args.slice(1));
    });
  }

  /**
   * Create a logger
   */
  private createLogger(options: ParsedOptions): Logger {
    return new Logger(
      this.options.stdout,
      this.options.stderr,
      {
        logLevel: NAMED_LEVELS[options['log-level']],
        useColor: options.color
      }
    );
  }

  /**
   * Create an API client
   */
  private async createAPIClient(options: ParsedOptions): Promise<[APIClient, OutputDirectoryStructure]> {
    const dirs = await prepareOutputDirectory(options['output-dir']);

    const logger = this.createLogger(options);

    const client = new APIClient({
      cacheDir: dirs.cacheDir,
      logger,
      sessionFile: paths.sessionFile,
      useCache: options.cache === undefined ? false : options.cache
    });

    return [client, dirs];
  }

}

/**
 * Run the CLI
 */
export function runCLI(options: CLIOPtions): Promise<void> {
  return new CLI(options).run();
}
