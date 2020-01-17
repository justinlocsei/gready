import os from 'os';
import path from 'path';
import yargs from 'yargs';

import APIClient from './api-client';
import Bookshelf from './bookshelf';
import Cache from './cache';
import Logger, { DEFAULT_LEVEL, getLevelNames, LevelName } from './logger';
import Repository from './repository';
import { CLIError } from './errors';
import { ExtractArrayType } from './types/util';
import { findReaders } from './search';
import { getDefaultConfigPath, getGoodreadsAPIKey, getGoodreadsSecret, loadConfig } from './config';
import { isNumeric, maybeMap, unreachable } from './util';
import { prepareDataDirectory } from './environment';
import { runSequence } from './flow';
import { SectionID, SECTION_IDS, summarizeBookshelf } from './summary';
import { summarizeSimilarReaders } from './search-results';

const CACHE_NAMES = ['data', 'response'] as const;

interface CLIOPtions {
  args: string[];
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
}

type CacheName = ExtractArrayType<typeof CACHE_NAMES>;
type CLINumber = number | string;
type CLIArray = (number | string)[];

interface CoreOptions {
  'cache-data': boolean;
  'cache-responses': boolean;
  color: boolean;
  config?: string;
  'data-dir': string;
  'log-level': string;
  'log-time': boolean;
  'shelf-percentile': CLINumber;
}

interface ClearCacheOptions extends CoreOptions {
  cache?: string;
  namespace?: CLIArray;
}

interface FindReadersOptions extends CoreOptions {
  'book-id'?: CLIArray;
  'min-books'?: CLINumber;
  reviews: CLINumber;
}

interface SummarizeOptions extends CoreOptions {
  section?: CLIArray;
  shelf?: CLIArray;
}

interface SyncBooksOptions extends CoreOptions {
  recent?: CLINumber;
}

type CommandOptions =
  | { command: 'clear-cache'; options: ClearCacheOptions; }
  | { command: 'find-readers'; options: FindReadersOptions; }
  | { command: 'log-in'; options: CoreOptions; }
  | { command: 'log-out'; options: CoreOptions; }
  | { command: 'summarize'; options: SummarizeOptions; }
  | { command: 'sync-books'; options: SyncBooksOptions; }

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
   * Find readers with similar tastes
   */
  async findReaders({
    bookIDs,
    maxReviews,
    minBooks = 0,
    shelfPercentile
  }: {
    bookIDs?: string[];
    maxReviews: number;
    minBooks?: number;
    shelfPercentile: number;
  }): Promise<void> {
    const userID = await this.apiClient.getUserID();
    let readBooks = await this.repo.getReadBooks(userID);

    if (bookIDs && bookIDs.length) {
      readBooks = bookIDs.map(function(bookID) {
        const review = readBooks.find(r => r.bookID === bookID);

        if (!review) {
          throw new CLIError(`No book found with ID: ${bookID}`);
        }

        return review;
      });
    }

    const readers = await findReaders({
      maxReviews,
      shelfPercentile,
      readBooks,
      repo: this.repo
    });

    if (this.logger.isEnabled) {
      this.stdout.write('\n');
    }

    const summary = summarizeSimilarReaders(readers.filter(r => r.books.length >= minBooks));

    this.stdout.write(summary + '\n');
  }

  /**
   * Allow gready to access the current user's Goodreads account
   */
  async logIn(): Promise<void> {
    const userID = await this.apiClient.logIn();
    this.logger.info('Logged in', `UserID=${userID}`);
  }

  /**
   * Prevent gready from accessing the current user's Goodreads account
   */
  logOut(): Promise<void> {
    return this.apiClient.logOut();
  }

  /**
   * Sync data on read books from Goodreads
   */
  async syncBooks(recent?: number): Promise<void> {
    const userID = await this.apiClient.getUserID();
    let readBooks = await this.repo.getReadBooks(userID);

    if (recent !== undefined) {
      readBooks = readBooks.slice(0, recent);
    }

    await runSequence(
      ['Sync books'],
      readBooks,
      this.logger,
      readBook => this.repo.getBook(readBook.bookID)
    );
  }

  /**
   * Summarize the local book data
   */
  async summarize({
    sections,
    shelfPercentile,
    shelves
  }: {
    sections?: SectionID[];
    shelfPercentile: number;
    shelves?: string[];
  }): Promise<void> {
    const userID = await this.apiClient.getUserID();
    const readBooks = await this.repo.getReadBooks(userID);

    const books = await this.repo.getLocalBooks(readBooks.map(b => b.bookID));
    const bookshelf = new Bookshelf(books, { shelfPercentile });

    const summary = summarizeBookshelf(
      shelves ? bookshelf.restrictShelves(...shelves) : bookshelf,
      { sections }
    );

    this.stdout.write(summary + '\n');
  }

}

/**
 * A function used for a command that lacks options
 */
function noOptions<T>(opts: T): T {
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
        default: getDefaultConfigPath(),
        describe: 'A path to a JSON configuration file',
        type: 'string'
      })
      .option('data-dir', {
        default: path.join(os.homedir(), '.gready'),
        describe: 'The directory in which to store all files created by gready',
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
      .option('shelf-percentile', {
        default: 1,
        describe: 'The minimum per-book and global percentile required for a shelf to be shown',
        type: 'number'
      })
      .command(
        'clear-cache',
        'Clear the cache',
        function(opts) {
          return opts
            .option('cache', {
              choices: CACHE_NAMES,
              describe: 'A specific cache to clear',
              type: 'string'
            })
            .option('namespace', {
              describe: 'A specific namespace to clear',
              type: 'array'
            });
        },
        options => resolve({ command: 'clear-cache', options })
      )
      .command(
        'find-readers',
        'Find readers with similar tastes',
        function(opts) {
          return opts
            .option('book-id', {
              describe: 'The ID of a book that readers must have rated',
              type: 'array'
            })
            .option('min-books', {
              describe: 'The minimum number of shared books required to show a reader',
              type: 'number'
            })
            .option('reviews', {
              default: 10,
              describe: 'The maximum number of reviews per book to query',
              type: 'number'
            });
        },
        options => resolve({ command: 'find-readers', options })
      )
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
        'sync-books',
        'Populate a local cache of data about your read books using the Goodreads API',
        function(opts) {
          return opts
            .option('recent', {
              describe: 'The number of recently read books for which to fetch data',
              type: 'number'
            });
        },
        options => resolve({ command: 'sync-books', options })
      )
      .command(
        'summarize',
        'Summarize your read books that are available in the local cache',
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
 * Ensure that an option is numeric
 */
function ensureNumeric<
  T extends object,
  U extends keyof T
>(options: T, optionName: U): number {
  const value = options[optionName];

  if (isNumeric(value)) {
    return value;
  } else {
    throw new CLIError(`The --${optionName} option must be a number`);
  }
}

/**
 * Clear a cache
 */
function clearCache(
  cacheMap: Record<CacheName, Cache>,
  cacheName: CacheName | undefined,
  namespaces: CLIArray | undefined
): Promise<void> {
  let caches = Object.values(cacheMap);

  if (cacheName) {
    caches = [cacheMap[cacheName]];
  }

  return Promise.all(caches.map(function(cache) {
    return cache.clear(maybeMap(namespaces, n => n.toString()));
  })).then(() => undefined);
}

/**
 * Start the CLI
 */
async function startCLI(cliOptions: CLIOPtions): Promise<void> {
  const parsed = await parseCLIArgs(cliOptions.args);
  const { options } = parsed;

  const { cacheDirs, sessionFile } = await prepareDataDirectory(options['data-dir']);
  const config = await loadConfig(options['config']);

  const logger = new Logger(cliOptions.stderr, {
    logLevel: options['log-level'] as LevelName,
    showTime: options['log-time'],
    useColor: options.color
  });

  const apiCache = new Cache(cacheDirs.apiRequests, { enabled: options['cache-responses'] });
  const dataCache = new Cache(cacheDirs.data, { enabled: options['cache-data'] });

  const apiClient = new APIClient({
    cache: apiCache,
    key: getGoodreadsAPIKey(),
    logger,
    secret: getGoodreadsSecret(),
    sessionFile
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

  const shelfPercentile = ensureNumeric(parsed.options, 'shelf-percentile');

  switch (parsed.command) {
    case 'clear-cache':
      return clearCache(
        {
          data: dataCache,
          response: apiCache
        },
        parsed.options['cache'] ? parsed.options['cache'] as CacheName : undefined,
        parsed.options['namespace']
      );

    case 'find-readers':
      return cli.findReaders({
        bookIDs: maybeMap(parsed.options['book-id'], s => s.toString()),
        maxReviews: ensureNumeric(parsed.options, 'reviews'),
        minBooks: parsed.options['min-books'] ? ensureNumeric(parsed.options, 'min-books') : undefined,
        shelfPercentile
      });

    case 'log-in':
      return cli.logIn();

    case 'log-out':
      return cli.logOut();

    case 'sync-books':
      return cli.syncBooks(
        parsed.options['recent'] ? ensureNumeric(parsed.options, 'recent') : undefined
      )

    case 'summarize':
      return cli.summarize({
        sections: maybeMap(parsed.options.section, s => s as SectionID),
        shelfPercentile,
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
