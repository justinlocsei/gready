import { CLIError } from './errors';
import { Configuration } from './types/config';
import { createBookshelf } from './bookshelf';
import { findRecommendedBooks, summarizeRecommendedBooks } from './search/books';
import { findSimilarReaders, summarizeSimilarReaders } from './search/readers';
import { Logger } from './logger';
import { OutputHandler } from './types/system';
import { ReadBook } from './types/core';
import { Repository } from './repository';
import { runSequence } from './flow';
import { SectionID, summarizeBookshelf } from './summary';
import { UserID } from './types/goodreads';

interface CLIOptions {
  config: Configuration;
  logger: Logger;
  recentBooks?: number;
  repo: Repository;
  userID: UserID;
  writeOutput: OutputHandler;
}

export class CLI {

  readonly config: Configuration;
  readonly logger: Logger;
  readonly recentBooks?: number;
  readonly repo: Repository;

  private userID: UserID;
  private writeOutput: OutputHandler;

  /**
   * Create a new CLI
   */
  constructor({
    config,
    logger,
    recentBooks,
    repo,
    userID,
    writeOutput
  }: CLIOptions) {
    this.config = config;
    this.logger = logger;
    this.recentBooks = recentBooks;
    this.repo = repo;
    this.userID = userID;
    this.writeOutput = writeOutput;
  }

  /**
   * Find recommended books
   */
  async findBooks({
    coreBookIDs,
    limit,
    minRating,
    percentile,
    shelves
  }: {
    coreBookIDs?: string[];
    limit?: number;
    minRating: number;
    percentile: number;
    shelves?: string[];
  }): Promise<void> {
    const readBooks = await this.getReadBooks();

    const recommended = await findRecommendedBooks({
      config: this.config,
      coreBookIDs,
      limit,
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
    let readBooks = await this.getReadBooks();

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
  async syncBooks(): Promise<void> {
    await runSequence(
      ['Sync books'],
      await this.getReadBooks(),
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
    const readBooks = await this.getReadBooks();

    const books = await this.repo.getLocalBooks(readBooks.map(b => b.bookID));
    const bookshelf = createBookshelf(books, this.config);

    const summarySections = summarizeBookshelf(
      shelves ? bookshelf.restrictShelves(...shelves) : bookshelf,
      { sections }
    );

    this.writeOutput(summarySections.join('\n\n'));
  }

  /**
   * Get the current user's read books
   */
  private getReadBooks(): Promise<ReadBook[]> {
    return this.repo.getReadBooks(this.userID, {
      recent: this.recentBooks
    });
  }

}

/**
 * Create a new CLI instance
 */
export async function createCLI(options: CLIOptions): Promise<CLI> {
  return new CLI(options);
}
