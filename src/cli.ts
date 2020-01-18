import APIClient from './api-client';
import Bookshelf from './bookshelf';
import Logger from './logger';
import Repository from './repository';
import { CLIError } from './errors';
import { findBooks, findReaders } from './search';
import { runSequence } from './flow';
import { SectionID, summarizeBookshelf } from './summary';
import { summarizeRecommendedBooks, summarizeSimilarReaders } from './search-results';

export default class CLI {

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
    const userID = await this.apiClient.getUserID();
    const readBooks = await this.repo.getReadBooks(userID);

    const recommended = await findBooks({
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
