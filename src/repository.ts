import { sortBy } from 'lodash';

import * as API from './types/api';
import { APIClient } from './api-client';
import { Cache } from './cache';
import { Configuration } from './types/config';
import { ensureArray } from './util';
import { extractReviewsIDFromWidget } from './reviews';
import { Logger } from './logger';
import { normalizeString } from './content';
import { SHELVES } from './goodreads';

import {
  Author,
  Book,
  ReadBook,
  Review,
  Shelf,
  SimilarBook
} from './types/core';

import {
  BookID,
  UserID
} from './types/goodreads';

const SHARED_NAMESPACES = {
  books: 'books'
};

interface RepositoryOptions {
  apiClient: APIClient;
  cache: Cache;
  config: Configuration;
  logger: Logger;
}

class RepositoryClass {

  readonly apiClient: APIClient;
  readonly cache: Cache;
  readonly config: Configuration;
  readonly logger: Logger;

  /**
   * Create a data repository
   */
  constructor({
    apiClient,
    cache,
    config,
    logger
  }: RepositoryOptions) {
    this.apiClient = apiClient;
    this.cache = cache;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Get information on a book
   */
  getBook(id: BookID): Promise<Book> {
    return this.cache.fetch([SHARED_NAMESPACES.books, id], async () => {
      this.logger.info('Load book', `ID=${id}`);

      const book = await this.apiClient.getBook(id);
      const normalized = await this.normalizeAPIBook(book);

      this.logger.info('Process book', normalized.title);

      return normalized;
    }).then(b => this.sanitizeBook(b));
  }

  /**
   * Get all books in a list that are locally available
   */
  async getLocalBooks(ids: BookID[]): Promise<Book[]> {
    const books = await this.cache.entries<Book>([SHARED_NAMESPACES.books]);

    const validBooks = books
      .filter(b => ids.includes(b.id))
      .map(b => this.sanitizeBook(b));

    return sortBy(validBooks, [
      b => b.title,
      b => b.id
    ]);
  }

  /**
   * Get all books read by a user, with the most recently read books first
   */
  getReadBooks(userID: UserID): Promise<ReadBook[]> {
    return this.cache.fetch(['read-books', userID], async () => {
      this.logger.info('Load read books', `UserID=${userID}`);

      const books = await this.apiClient.getReadBooks(userID);

      return sortBy(
        books.map(b => this.normalizeAPIReadBook(b)),
        [
          b => b.posted * -1,
          b => b.bookID
        ]
      );
    });
  }

  /**
   * Get similar reviews of a book
   */
  async getSimilarReviews(
    book: Book,
    readBook: ReadBook,
    limit: number
  ): Promise<Review[]> {
    return this.cache.fetch(['similar-reviews', readBook.id, limit], async () => {
      this.logger.info('Load similar reviews', `BookID=${book.id}`, `Rating=${readBook.rating}`);

      const reviews = await this.apiClient.getBookReviews(book.reviewsID, {
        limit,
        rating: readBook.rating
      });

      return reviews.map(r => this.normalizeAPIReview(r));
    });
  }

  /**
   * Normalize a read book returned by the Goodreads API
   */
  private normalizeAPIReadBook(readBook: API.ReadBook): ReadBook {
    const shelves = ensureArray(readBook.shelves.shelf).map(function(shelf): string {
      return shelf.$.name;
    });

    return {
      bookID: readBook.book.id._,
      id: readBook.id,
      posted: new Date(readBook.read_at || readBook.date_added).getTime(),
      rating: readBook.rating ? parseInt(readBook.rating, 10) : undefined,
      shelves
    };
  }

  /**
   * Normalize a review returned by the Goodreads API
   */
  private normalizeAPIReview(review: API.Review): Review {
    const { user } = review;

    return {
      ...this.normalizeAPIReadBook(review),
      user: {
        id: user.id,
        name: normalizeString(user.name),
        profileURL: user.link
      }
    };
  }

  /**
   * Normalize a book returned by the Goodreads API
   */
  private async normalizeAPIBook(book: API.Book): Promise<Book> {
    const { authors, id, work } = book;

    const title = normalizeString(book.title || work.original_title);
    const ratingsSum = parseInt(work.ratings_sum._, 10);
    const totalRatings = parseInt(work.ratings_count._, 10);

    const author = this.extractAuthor(authors);

    const shelves = ensureArray(book.popular_shelves.shelf).map(function({ $: shelf }): Shelf {
      return {
        count: parseInt(shelf.count, 10),
        name: normalizeString(shelf.name)
      };
    });

    const similarBooks = (book.similar_books && book.similar_books.book) || [];
    const canonicalID = work.best_book_id._;

    const similar = ensureArray(similarBooks).map((book): SimilarBook => {
      return {
        author: this.extractAuthor(book.authors),
        id: book.id
      };
    });

    const normalized: Book = {
      author,
      averageRating: totalRatings > 0 ? ratingsSum / totalRatings : undefined,
      canonicalID,
      id: id,
      publisher: book.publisher,
      reviewsID: extractReviewsIDFromWidget(book.reviews_widget) || id,
      shelves,
      similarBooks: similar,
      title,
      totalRatings,
      workID: work.id._
    };

    if (!normalized.publisher && id !== canonicalID) {
      const canonicalBook = await this.apiClient.getBook(canonicalID);
      normalized.publisher = canonicalBook.publisher;
    }

    if (!normalized.publisher) {
      normalized.publisher = author.name;
    }

    normalized.publisher = normalizeString(normalized.publisher);

    return normalized;
  }

  /**
   * Extract a primary author from authorship information
   */
  private extractAuthor(authorship: API.Authorship): Author {
    const authors = ensureArray(authorship.author).map(function(author): Author {
      return {
        id: author.id,
        name: normalizeString(author.name)
      };
    });

    return authors[0];
  }

  /**
   * Clean up a book's data based on the current configuration
   */
  private sanitizeBook(book: Book): Book {
    const { publisher, shelves } = book;
    const { ignoreShelves, publisherAliases, shelfAliases } = this.config;

    const excludeShelves = new Set([
      SHELVES.currentlyReading,
      SHELVES.toRead,
      ...ignoreShelves
    ]);

    const userShelves = shelves.filter(s => !excludeShelves.has(s.name));
    const mergedShelves = this.shelfAliases(userShelves, shelfAliases);

    return {
      ...book,
      publisher: this.publisherAliases(publisher, publisherAliases),
      shelves: sortBy(mergedShelves, [s => s.count * -1, s => s.name])
    };
  }

  /**
   * Merge publishers specified in a lookup
   */
  private publisherAliases(publisher: string, merge: Record<string, string[]>): string {
    const group = Object.keys(merge).find(function(name) {
      return merge[name].includes(publisher);
    });

    return group || publisher;
  }

  /**
   * Merge shelves specified in a lookup
   */
  private shelfAliases(shelves: Shelf[], merge: Record<string, string[]>): Shelf[] {
    const merged = Object.keys(merge).reduce(function(previous: Shelf[], group) {
      const members = shelves.filter(function(shelf) {
        return shelf.name === group || merge[group].includes(shelf.name);
      });

      const totalCount = members.reduce((p, s) => p + s.count, 0);

      if (totalCount) {
        previous.push({
          count: totalCount,
          name: group
        });
      }

      return previous;
    }, []);

    const names = Object.keys(merge).reduce(function(previous: string[], group) {
      return previous.concat(...merge[group], group);
    }, []);

    const nameSet = new Set(names);

    return shelves
      .filter(s => !nameSet.has(s.name))
      .concat(merged);
  }

}

export type Repository = InstanceType<typeof RepositoryClass>;

/**
 * Create a repository
 */
export function createRepository(options: RepositoryOptions): Repository {
  return new RepositoryClass(options);
}
