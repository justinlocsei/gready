import yargs from 'yargs';

import APIClient from './api-client';
import Cache from './cache';
import Logger, { DEFAULT_LEVEL, getLevelNames, LevelName } from './logger';
import Repository from './repository';
import { OutputDirectoryStructure, paths, prepareOutputDirectory } from './environment';
import { unreachable } from './data';

interface CLIOPtions {
  args: string[];
  stderr: NodeJS.WriteStream;
  stdout: NodeJS.WriteStream;
}

type Command =
  | 'log-in'
  | 'log-out'
  | 'scrape'

interface ParsedOptions {
  'cache-data': boolean;
  'cache-responses': boolean;
  color: boolean;
  command: Command;
  'log-level': string;
  'output-dir': string;
}

class CLI {

  private apiClient: APIClient;
  private logger: Logger;
  private options: ParsedOptions;
  private outputDir: OutputDirectoryStructure;
  private repo: Repository;

  /**
   * Create a new CLI
   */
  constructor({
    apiClient,
    logger,
    options,
    outputDir,
    repo
  }: {
    apiClient: APIClient;
    logger: Logger;
    options: ParsedOptions;
    outputDir: OutputDirectoryStructure;
    repo: Repository;
  }) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.options = options;
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
  async scrape(): Promise<void> {
    const userID = await this.apiClient.getUserID();
    const readBooks = await this.repo.getReadBooks(userID);

    for (const readBook of readBooks) {
      await this.repo.getBook(readBook.id);
    }
  }

}

/**
 * Parse command-line options
 */
function parseOptions(options: CLIOPtions): Promise<ParsedOptions> {
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
        y => y,
        args => resolve({ ...args, command: 'log-in' })
      )
      .command(
        'log-out',
        'Prevent gready from accessing your Goodreads account',
        y => y,
        args => resolve({ ...args, command: 'log-out' })
      )
      .command(
        'scrape',
        'Scrape data from Goodreads',
        y => y,
        args => resolve({ ...args, command: 'scrape' })
      )
      .demandCommand(1, 'You must specify a subcommand')
      .strict()
      .help('h')
      .alias('h', 'help')
      .version()
      .parse(options.args.slice(1));
  });
}

/**
 * Run the CLI
 */
export async function runCLI(options: CLIOPtions): Promise<void> {
  const parsedOptions = await parseOptions(options);
  const outputDir = await prepareOutputDirectory(parsedOptions['output-dir']);

  const logger = new Logger(
    options.stdout,
    options.stderr,
    {
      logLevel: parsedOptions['log-level'] as LevelName,
      useColor: parsedOptions.color
    }
  );

  const apiCache = new Cache(outputDir.apiRequestsDir, { enabled: parsedOptions['cache-responses'] });
  const dataCache = new Cache(outputDir.dataDir, { enabled: parsedOptions['cache-data'] });

  const apiClient = new APIClient({
    cache: apiCache,
    logger,
    sessionFile: paths.sessionFile
  });

  const repo = new Repository(apiClient, dataCache);

  const cli = new CLI({
    apiClient,
    logger,
    options: parsedOptions,
    outputDir,
    repo
  });

  switch (parsedOptions.command) {
    case 'log-in':
      return cli.logIn();
    case 'log-out':
      return cli.logOut();
    case 'scrape':
      return cli.scrape();
    default:
      unreachable(parsedOptions.command);
  }
}
