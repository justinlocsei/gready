import Bookshelf from './bookshelf';
import Logger from './logger';
import Repository from './repository';
import { CLIError } from './errors';
import { findRecommendedBooks, summarizeRecommendedBooks } from './search/books';
import { findSimilarReaders, summarizeSimilarReaders } from './search/readers';
import { OutputHandler } from './types/system';
import { runSequence } from './flow';
import { SectionID, summarizeBookshelf } from './summary';
import { UserID } from './types/goodreads';

export default class CLI {

  readonly logger: Logger;
  readonly repo: Repository;

  private userID: UserID;
  private writeOutput: OutputHandler;

  /**
   * Create a new CLI
   */
  constructor({
    logger,
    repo,
    userID,
    writeOutput
  }: {
    logger: Logger;
    repo: Repository;
    userID: UserID;
    writeOutput: OutputHandler;
  }) {
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
    shelfPercentile,
    shelves
  }: {
    coreBookIDs?: string[];
    minRating: number;
    percentile: number;
    shelfPercentile: number;
    shelves?: string[];
  }): Promise<void> {
    const readBooks = await this.repo.getReadBooks(this.userID);

    const recommended = await findRecommendedBooks({
      coreBookIDs,
      minRating,
      percentile,
      readBooks,
      repo: this.repo,
      shelfPercentile,
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
    minBooks = 0,
    shelfPercentile
  }: {
    bookIDs?: string[];
    maxReviews: number;
    minBooks?: number;
    shelfPercentile: number;
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
      maxReviews,
      shelfPercentile,
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
    shelfPercentile,
    shelves
  }: {
    sections?: SectionID[];
    shelfPercentile: number;
    shelves?: string[];
  }): Promise<void> {
    const readBooks = await this.repo.getReadBooks(this.userID);

    const books = await this.repo.getLocalBooks(readBooks.map(b => b.bookID));
    const bookshelf = new Bookshelf(books, { shelfPercentile });

    const summarySections = summarizeBookshelf(
      shelves ? bookshelf.restrictShelves(...shelves) : bookshelf,
      { sections }
    );

    this.writeOutput(summarySections.join('\n\n'));
  }

}
