import { CLIError } from './errors';
import { Configuration } from './types/config';
import { createBookshelf } from './bookshelf';
import { findRecommendedBooks, summarizeRecommendedBooks } from './search/books';
import { findSimilarReaders, summarizeSimilarReaders } from './search/readers';
import { Logger } from './logger';
import { OutputHandler } from './types/system';
import { Repository } from './repository';
import { runSequence } from './flow';
import { SectionID, summarizeBookshelf } from './summary';
import { UserID } from './types/goodreads';

interface CLIOptions {
  config: Configuration;
  logger: Logger;
  repo: Repository;
  userID: UserID;
  writeOutput: OutputHandler;
}

export class CLI {

  readonly config: Configuration;
  readonly logger: Logger;
  readonly repo: Repository;

  private userID: UserID;
  private writeOutput: OutputHandler;

  /**
   * Create a new CLI
   */
  constructor({
    config,
    logger,
    repo,
    userID,
    writeOutput
  }: CLIOptions) {
    this.config = config;
    this.logger = logger;
    this.repo = repo;
    this.userID = userID;
    this.writeOutput = writeOutput;
  }

  /**
   * Find recommended books
   */
  async findBooks({
    coreBookIDs,
    minRating,
    percentile,
    shelves
  }: {
    coreBookIDs?: string[];
    minRating: number;
    percentile: number;
    shelves?: string[];
  }): Promise<void> {
    const readBooks = await this.repo.getReadBooks(this.userID);

    const recommended = await findRecommendedBooks({
      config: this.config,
      coreBookIDs,
      minRating,
      percentile,
      readBooks,
      repo: this.repo,
      shelves
    });

    if (this.logger.isEnabled) {
      this.writeOutput('');
    }

    this.writeOutput(summarizeRecommendedBooks(recommended));
  }

  /**
   * Find readers with similar tastes
   */
  async findReaders({
    bookIDs,
    maxReviews,
    minBooks = 0
  }: {
    bookIDs?: string[];
    maxReviews: number;
    minBooks?: number;
  }): Promise<void> {
    let readBooks = await this.repo.getReadBooks(this.userID);

    if (bookIDs && bookIDs.length) {
      readBooks = bookIDs.map(function(bookID) {
        const review = readBooks.find(r => r.bookID === bookID);

        if (!review) {
          throw new CLIError(`No book found with ID: ${bookID}`);
        }

        return review;
      });
    }

    const readers = await findSimilarReaders({
      config: this.config,
      maxReviews,
      readBooks,
      repo: this.repo
    });

    const bestMatches = readers.filter(r => r.books.length >= minBooks);

    if (this.logger.isEnabled) {
      this.writeOutput('');
    }

    this.writeOutput(summarizeSimilarReaders(bestMatches));
  }

  /**
   * Sync data on read books from Goodreads
   */
  async syncBooks(recent?: number): Promise<void> {
    let readBooks = await this.repo.getReadBooks(this.userID);

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
    shelves
  }: {
    sections?: SectionID[];
    shelves?: string[];
  } = {}): Promise<void> {
    const readBooks = await this.repo.getReadBooks(this.userID);

    const books = await this.repo.getLocalBooks(readBooks.map(b => b.bookID));
    const bookshelf = createBookshelf(books, this.config);

    const summarySections = summarizeBookshelf(
      shelves ? bookshelf.restrictShelves(...shelves) : bookshelf,
      { sections }
    );

    this.writeOutput(summarySections.join('\n\n'));
  }

}

/**
 * Create a new CLI instance
 */
export async function createCLI(options: CLIOptions): Promise<CLI> {
  return new CLI(options);
}
