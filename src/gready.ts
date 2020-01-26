import os from 'os';
import path from 'path';
import yargs from 'yargs';

import APIClient from './api-client';
import Cache from './cache';
import CLI from './cli';
import Logger, { DEFAULT_LEVEL, getLevelNames, LevelName } from './logger';
import Repository from './repository';
import { CLIError } from './errors';
import { Configuration } from './types/config';
import { ExtractArrayType } from './types/util';
import { getGoodreadsAPIKey, getGoodreadsUserID, loadConfig } from './config';
import { isNumeric, maybeMap, unreachable } from './util';
import { paths, prepareDataDirectory } from './environment';
import { SectionID, SECTION_IDS } from './summary';

const CACHE_NAMES = ['data', 'response'] as const;

interface CLIOptions {
  args: string[];
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
}

type CacheName = ExtractArrayType<typeof CACHE_NAMES>;
type CacheMap = Record<CacheName, Cache>;
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

interface FindBooksOptions extends CoreOptions {
  'book-id'?: CLIArray;
  'min-rating': CLINumber;
  percentile: CLINumber;
  'shelf'?: CLIArray;
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
  | { command: 'find-books'; options: FindBooksOptions; }
  | { command: 'find-readers'; options: FindReadersOptions; }
  | { command: 'show-cache-stats'; options: CoreOptions; }
  | { command: 'summarize'; options: SummarizeOptions; }
  | { command: 'sync-books'; options: SyncBooksOptions; }

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
        'find-books',
        'Find recommended books',
        function(opts) {
          return opts
            .option('book-id', {
              describe: 'The ID of a book that must be related to the recommended books',
              type: 'array'
            })
            .option('min-rating', {
              default: 3,
              describe: 'The minimum rating a read book must have in order to generate recommendations',
              type: 'number'
            })
            .option('percentile', {
              default: 1,
              describe: 'The minimum percentile of recommendations to show',
              type: 'number'
            })
            .option('shelf', {
              describe: 'A shelf in which a book must appear in order to be used as a source of recommendations',
              type: 'array'
            });
        },
        options => resolve({ command: 'find-books', options })
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
        'show-cache-stats',
        'Show information on the available caches',
        opts => opts,
        options => resolve({ command: 'show-cache-stats', options })
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
  cacheMap: CacheMap,
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
 * Show stats on a series of caches
 */
function showCacheStats(cacheMap: CacheMap): Promise<string> {
  const names = Object.keys(cacheMap).sort();

  return Promise.all(names.map(async function(name) {
    const cache = cacheMap[name as CacheName];
    const stats = await cache.stats();

    const lines = [
      name,
      ...stats.map(s => `  ${s.namespace}: ${s.items}`)
    ];

    return lines.join('\n');
  })).then(text => text.join('\n\n'));
}

/**
 * Start the CLI
 */
async function startCLI(cliOptions: CLIOptions): Promise<void> {
  const parsed = await parseCLIArgs(cliOptions.args);
  const { options } = parsed;

  const { cacheDirs } = await prepareDataDirectory(options['data-dir']);

  let config: Configuration;

  if (options['config']) {
    config = await loadConfig(options['config']);
  } else {
    config = await loadConfig(paths.defaultConfig, { allowMissing: true });
  }

  const logger = new Logger(cliOptions.stderr, {
    logLevel: options['log-level'] as LevelName,
    showTime: options['log-time'],
    useColor: options.color
  });

  const apiCache = new Cache(cacheDirs.apiRequests, { enabled: options['cache-responses'] });
  const dataCache = new Cache(cacheDirs.data, { enabled: options['cache-data'] });

  const cacheMap: CacheMap = {
    data: dataCache,
    response: apiCache
  };

  const apiClient = new APIClient({
    apiKey: getGoodreadsAPIKey(),
    cache: apiCache,
    logger
  });

  const repo = new Repository({
    apiClient,
    cache: dataCache,
    config,
    logger
  });

  const cli = new CLI({
    logger,
    repo,
    stdout: cliOptions.stdout,
    userID: getGoodreadsUserID()
  });

  const shelfPercentile = ensureNumeric(parsed.options, 'shelf-percentile');

  switch (parsed.command) {
    case 'clear-cache':
      return clearCache(
        cacheMap,
        parsed.options['cache'] ? parsed.options['cache'] as CacheName : undefined,
        parsed.options['namespace']
      );

    case 'find-books':
      return cli.findBooks({
        coreBookIDs: maybeMap(parsed.options['book-id'], s => s.toString()),
        minRating: ensureNumeric(parsed.options, 'min-rating'),
        percentile: ensureNumeric(parsed.options, 'percentile'),
        shelfPercentile,
        shelves: maybeMap(parsed.options['shelf'], s => s.toString())
      });

    case 'find-readers':
      return cli.findReaders({
        bookIDs: maybeMap(parsed.options['book-id'], s => s.toString()),
        maxReviews: ensureNumeric(parsed.options, 'reviews'),
        minBooks: parsed.options['min-books'] ? ensureNumeric(parsed.options, 'min-books') : undefined,
        shelfPercentile
      });

    case 'show-cache-stats':
      return showCacheStats(cacheMap).then(function(stats) {
        cliOptions.stdout.write(stats + '\n');
      });

    case 'summarize':
      return cli.summarize({
        sections: maybeMap(parsed.options.section, s => s as SectionID),
        shelfPercentile,
        shelves: maybeMap(parsed.options.shelf, s => s.toString())
      });

    case 'sync-books':
      return cli.syncBooks(
        parsed.options['recent'] ? ensureNumeric(parsed.options, 'recent') : undefined
      );

    default:
      unreachable(parsed);
  }
}

/**
 * Run the CLI
 */
export function runCLI(options: CLIOptions): Promise<void> {
  return startCLI(options).catch(function(error) {
    if (error instanceof CLIError) {
      process.exitCode = 1;

      options.stderr.write(`${error.message}\n\nUsage\n-----\n`);
      yargs.showHelp('error');
    } else {
      throw error;
    }
  });
}
