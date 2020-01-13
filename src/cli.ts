import yargs from 'yargs';

import APIClient from './api-client';
import Cache from './cache';
import Logger, { DEFAULT_LEVEL, getLevelNames, LevelName } from './logger';
import Repository from './repository';
import { Book, ReadBook } from './types/data';
import { CLIError } from './errors';
import { findReaders } from './search';
import { isNumeric, maybeMap, unreachable } from './data';
import { loadConfig } from './config';
import { paths, prepareOutputDirectory } from './environment';
import { SectionID, SECTION_IDS, summarizeBooks } from './summary';

interface CLIOPtions {
  args: string[];
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
}

type CLIString = number | string;

interface CoreOptions {
  'cache-data': boolean;
  'cache-responses': boolean;
  color: boolean;
  config?: string;
  'log-level': string;
  'log-time': boolean;
  'min-shelf-percent': number;
  'output-dir': string;
}

interface ScrapeOptions extends CoreOptions {
  'recent-books'?: number;
}

interface SummarizeOptions extends CoreOptions {
  section?: CLIString[];
  shelf?: CLIString[];
}

type CommandOptions =
  | { command: 'log-in'; options: CoreOptions; }
  | { command: 'log-out'; options: CoreOptions; }
  | { command: 'scrape'; options: ScrapeOptions; }
  | { command: 'summarize'; options: SummarizeOptions; }

class CLI {

  private apiClient: APIClient;
  private logger: Logger;
  private repo: Repository;
  private stdout: NodeJS.WritableStream;

  /**
   * Create a new CLI
   */
  constructor({
    apiClient,
    logger,
    repo,
    stdout
  }: {
    apiClient: APIClient;
    logger: Logger;
    repo: Repository;
    stdout: NodeJS.WritableStream;
  }) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.repo = repo;
    this.stdout = stdout;
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
    let readBook: ReadBook;

    while (index < totalBooks) {
      readBook = readBooks[index];

      const meta = [
        `Index=${index + 1}`,
        `Total=${totalBooks}`,
        `ID=${readBook.bookID}`
      ];

      this.logger.info('Load book', ...meta);

      book = await this.repo.getBook(readBook.bookID);
      index++;

      this.logger.info('Save book', ...meta, book.title);
    }
  }

  /**
   * Summarize the local book data
   */
  async summarize({
    minShelfPercent,
    sections,
    shelves
  }: {
    minShelfPercent: number;
    sections?: SectionID[];
    shelves?: string[];
  }): Promise<void> {
    const userID = await this.apiClient.getUserID();
    const readBooks = await this.repo.getReadBooks(userID);
    const books = await this.repo.getLocalBooks(readBooks.map(b => b.bookID));

    const summary = summarizeBooks(books, {
      minShelfPercent,
      sections,
      shelves
    });

    this.stdout.write(summary + '\n');
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
      .option('config', {
        describe: 'A path to a JSON configuration file',
        type: 'string'
      })
      .option('log-level', {
        choices: getLevelNames(),
        default: DEFAULT_LEVEL,
        describe: 'The log level to use',
        type: 'string'
      })
      .option('log-time', {
        default: false,
        describe: 'Show the elapsed time between log entries',
        type: 'boolean'
      })
      .option('min-shelf-percent', {
        default: 1,
        describe: 'The minimum percentage of a shelf’s count relative to the highest count required to include it in analyses',
        type: 'number'
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
      .command(
        'summarize',
        'Summarize local data',
        function(opts) {
          return opts
            .option('section', {
              choices: SECTION_IDS,
              describe: 'A specific section to show',
              type: 'array'
            })
            .option('shelf', {
              describe: 'A shelf that must be associated with any summarized book',
              type: 'array'
            });
        },
        options => resolve({ command: 'summarize', options })
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
  const config = await loadConfig(options['config']);

  const logger = new Logger(cliOptions.stderr, {
    logLevel: options['log-level'] as LevelName,
    showTime: options['log-time'],
    useColor: options.color
  });

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
    config,
    logger
  });

  const cli = new CLI({
    apiClient,
    logger,
    repo,
    stdout: cliOptions.stdout
  });

  const minShelfPercent = validateOption(
    parsed.options,
    'min-shelf-percent',
    'must be a number',
    isNumeric
  );

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

    case 'summarize':
      return cli.summarize({
        minShelfPercent,
        sections: maybeMap(parsed.options.section, s => s as SectionID),
        shelves: maybeMap(parsed.options.shelf, s => s.toString())
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
