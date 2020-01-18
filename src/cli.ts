import Bookshelf from './bookshelf';
import Logger from './logger';
import Repository from './repository';
import { CLIError } from './errors';
import { findRecommendedBooks, summarizeRecommendedBooks } from './search/books';
import { findSimilarReaders, summarizeSimilarReaders } from './search/readers';
import { runSequence } from './flow';
import { SectionID, summarizeBookshelf } from './summary';
import { UserID } from './types/goodreads';

export default class CLI {

  private logger: Logger;
  private repo: Repository;
  private stdout: NodeJS.WritableStream;
  private userID: UserID;

  /**
   * Create a new CLI
   */
  constructor({
    logger,
    repo,
    stdout,
    userID
  }: {
    logger: Logger;
    repo: Repository;
    stdout: NodeJS.WritableStream;
    userID: UserID;
  }) {
    this.logger = logger;
    this.repo = repo;
    this.stdout = stdout;
    this.userID = userID;
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
      this.stdout.write('\n');
    }

    this.stdout.write(summarizeRecommendedBooks(recommended) + '\n');
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

    if (this.logger.isEnabled) {
      this.stdout.write('\n');
    }

    const summary = summarizeSimilarReaders(readers.filter(r => r.books.length >= minBooks));

    this.stdout.write(summary + '\n');
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

    const summary = summarizeBookshelf(
      shelves ? bookshelf.restrictShelves(...shelves) : bookshelf,
      { sections }
    );

    this.stdout.write(summary + '\n');
  }

}
