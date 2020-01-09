import yargs from 'yargs';

import APIClient from './api-client';
import Cache from './cache';
import Logger, { DEFAULT_LEVEL, getLevelNames, LevelName } from './logger';
import Repository from './repository';
import { Book } from './types/data';
import { CLIError } from './errors';
import { isNumeric, unreachable } from './data';
import { OutputDirectoryStructure, paths, prepareOutputDirectory } from './environment';

interface CLIOPtions {
  args: string[];
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
}

interface CoreOptions {
  'cache-data': boolean;
  'cache-responses': boolean;
  color: boolean;
  'log-level': string;
  'output-dir': string;
}

interface ScrapeOptions extends CoreOptions {
  'recent-books'?: number;
}

type CommandOptions =
  | { command: 'log-in'; options: CoreOptions; }
  | { command: 'log-out'; options: CoreOptions; }
  | { command: 'scrape'; options: ScrapeOptions; }

class CLI {

  private apiClient: APIClient;
  private logger: Logger;
  private outputDir: OutputDirectoryStructure;
  private repo: Repository;

  /**
   * Create a new CLI
   */
  constructor({
    apiClient,
    logger,
    outputDir,
    repo
  }: {
    apiClient: APIClient;
    logger: Logger;
    outputDir: OutputDirectoryStructure;
    repo: Repository;
  }) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.outputDir = outputDir;
    this.repo = repo;
  }

  /**
   * Allow gready to access the current user's Goodreads account
   */
  async logIn(): Promise<void> {
    const userID = await this.apiClient.logIn();
    this.logger.info(`Logged in | UserID=${userID}`);
  }

  /**
   * Prevent gready from accessing the current user's Goodreads account
   */
  logOut(): Promise<void> {
    return this.apiClient.logOut();
  }

  /**
   * Scrape data from the Goodreads API
   */
  async scrape({
    recentBooks
  }: {
    recentBooks?: number;
  }): Promise<void> {
    const userID = await this.apiClient.getUserID();
    let readBooks = await this.repo.getReadBooks(userID);

    if (recentBooks !== undefined) {
      readBooks = readBooks.slice(0, recentBooks);
    }

    let index = 0;
    const totalBooks = readBooks.length;

    let book: Book;

    while (index < totalBooks) {
      this.logger.info('Get book', `Index=${index + 1}`, `Total=${totalBooks}`);

      book = await this.repo.getBook(readBooks[index].id);
      index++;

      this.logger.info('Got book', `Index=${index}`, book.title);
    }
  }

}

/**
 * A function used for a command that lacks options
 */
function noOptions<T>(opts: T) {
  return opts;
}

/**
 * Parse command-line arguments
 */
function parseCLIArgs(args: string[]): Promise<CommandOptions> {
  return new Promise(function(resolve, reject) {
    yargs
     .option('cache-data', {
        default: true,
        describe: 'Cache normalized data',
        type: 'boolean'
      })
      .option('cache-responses', {
        default: true,
        describe: 'Cache responses to Goodreads API requests',
        type: 'boolean'
      })
      .option('color', {
        default: true,
        describe: 'Use colored output',
        type: 'boolean'
      })
      .option('log-level', {
        choices: getLevelNames(),
        default: DEFAULT_LEVEL,
        describe: 'The log level to use',
        type: 'string'
      })
      .option('output-dir', {
        default: paths.outputDir,
        describe: 'The directory in which to store generated files',
        type: 'string'
      })
      .command(
        'log-in',
        'Allow gready to access your Goodreads account',
        noOptions,
        options => resolve({ command: 'log-in', options })
      )
      .command(
        'log-out',
        'Prevent gready from accessing your Goodreads account',
        noOptions,
        options => resolve({ command: 'log-out', options })
      )
      .command(
        'scrape',
        'Scrape data from Goodreads',
        function(opts) {
          return opts
            .option('recent-books', {
              describe: 'Fetch data for the N most recent books',
              type: 'number'
            });
        },
        options => resolve({ command: 'scrape', options })
      )
      .demandCommand(1, 'You must specify a subcommand')
      .strict()
      .help('h')
      .alias('h', 'help')
      .scriptName('gready')
      .version()
      .parse(args);
  });
}

/**
 * Ensure that an option is valid
 */
function validateOption<T extends object, U extends keyof T>(
  options: T,
  optionName: U,
  errorMessage: string,
  validator: (value: unknown) => boolean
) {
  const value = options[optionName];

  if (validator(value)) {
    return value;
  } else {
    throw new CLIError(`The --${optionName} option ${errorMessage}`);
  }
}

/**
 * Start the CLI
 */
async function startCLI(cliOptions: CLIOPtions): Promise<void> {
  const parsed = await parseCLIArgs(cliOptions.args);
  const { options } = parsed;

  const outputDir = await prepareOutputDirectory(options['output-dir']);

  const logger = new Logger(
    cliOptions.stdout,
    cliOptions.stderr,
    {
      logLevel: options['log-level'] as LevelName,
      useColor: options.color
    }
  );

  const apiCache = new Cache(outputDir.apiRequestsDir, { enabled: options['cache-responses'] });
  const dataCache = new Cache(outputDir.dataDir, { enabled: options['cache-data'] });

  const apiClient = new APIClient({
    cache: apiCache,
    logger,
    sessionFile: paths.sessionFile
  });

  const repo = new Repository({
    apiClient,
    cache: dataCache,
    logger
  });

  const cli = new CLI({
    apiClient,
    logger,
    outputDir,
    repo
  });

  switch (parsed.command) {
    case 'log-in':
      return cli.logIn();

    case 'log-out':
      return cli.logOut();

    case 'scrape':
      return cli.scrape({
        recentBooks: validateOption(
          parsed.options,
          'recent-books',
          'must be a number',
          v => v === undefined || isNumeric(v)
        )
      });

    default:
      unreachable(parsed);
  }
}

/**
 * Run the CLI
 */
export function runCLI(options: CLIOPtions): Promise<void> {
  return startCLI(options).catch(function(error) {
    if (error instanceof CLIError) {
      process.exitCode = 1;

      console.error(`${error.message}\n\nUsage\n-----\n`);
      yargs.showHelp('error');
    } else {
      throw error;
    }
  });
}
