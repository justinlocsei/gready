import { sortBy } from 'lodash';

import * as API from './types/api';
import APIClient from './api-client';
import Cache from './cache';
import Logger from './logger';
import { Configuration } from './types/config';
import { ensureArray, normalizeString } from './util';
import { extractCanonicalIDFromReviewsWidget } from './reviews';
import { SHELVES } from './goodreads';

import {
  Author,
  Book,
  ReadBook,
  Review,
  Shelf,
  UserMeta
} from './types/core';

import {
  BookID,
  UserID
} from './types/goodreads';

const SHARED_NAMESPACES = {
  books: 'books'
};

export default class Repository {

  private apiClient: APIClient;
  private cache: Cache;
  private config: Configuration;
  private logger: Logger;

  /**
   * Create a data repository
   */
  constructor({
    apiClient,
    cache,
    config,
    logger
  }: {
    apiClient: APIClient;
    cache: Cache;
    config: Configuration;
    logger: Logger;
  }) {
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

      return this.normalizeBookInfo(book);
    }).then(b => this.sanitizeBook(b));
  }

  /**
   * Get all books in a list that are locally available
   */
  async getLocalBooks(ids: BookID[]): Promise<Book[]> {
    const books = await this.cache.entries<Book>([SHARED_NAMESPACES.books])

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
        books.map(b => this.normalizeReadBook(b)),
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
  async getSimilarReviews(readBook: ReadBook, limit: number): Promise<Review[]> {
    return this.cache.fetch(['similar-reviews', readBook.id, limit], async () => {
      const reviews = await this.apiClient.getBookReviews(readBook.bookID, {
        limit,
        rating: readBook.rating
      });

      return reviews.map(r => this.normalizeReview(r));
    });
  }

  /**
   * Get the names of a user's shelves
   */
  async getUserShelves(id: UserID): Promise<string[]> {
    const meta = await this.getUserMeta(id);
    return meta.shelves;
  }

  /**
   * Get user metadata
   */
  private getUserMeta(id: UserID): Promise<UserMeta> {
    return this.cache.fetch(['user-meta', id], async () => {
      const user = await this.apiClient.getUser(id);
      return this.normalizeUserMeta(user);
    });
  }

  /**
   * Convert user information from the API to user metadata
   */
  private normalizeUserMeta(user: API.User): UserMeta {
    const shelves = user.user_shelves;

    const shelfNames = shelves
      ? ensureArray(shelves.user_shelf).map(s => s.name)
      : [];

    return {
      id: user.id,
      shelves: shelfNames.sort()
    };
  }

  /**
   * Convert a read book from the API to a read book
   */
  private normalizeReadBook(readBook: API.ReadBook): ReadBook {
    const shelves = ensureArray(readBook.shelves.shelf).map(function(shelf): string {
      return shelf.$.name;
    });

    return {
      bookID: readBook.book.id._,
      id: readBook.id,
      posted: new Date(readBook.read_at || readBook.date_added).getTime(),
      rating: parseInt(readBook.rating, 10),
      shelves
    };
  }

  /**
   * Convert a review from the API to a book review
   */
  private normalizeReview(review: API.Review): Review {
    const { user } = review;

    return {
      ...this.normalizeReadBook(review),
      user: {
        id: user.id,
        name: normalizeString(user.name),
        profileURL: user.link
      }
    };
  }

  /**
   * Convert book information from the API to a book
   */
  private async normalizeBookInfo(book: API.Book): Promise<Book> {
    const { authors: rawAuthors, id, work } = book;

    const ratingsSum = parseInt(work.ratings_sum._, 10);
    const totalRatings = parseInt(work.ratings_count._, 10);

    const authors = ensureArray(rawAuthors.author).map(function(author): Author {
      return {
        id: author.id,
        name: normalizeString(author.name)
      };
    });

    const shelves = book.popular_shelves.shelf.map(function({ $: shelf }): Shelf {
      return {
        count: parseInt(shelf.count, 10),
        name: normalizeString(shelf.name)
      };
    });

    const canonicalID = extractCanonicalIDFromReviewsWidget(book.reviews_widget);
    const reviews = canonicalID ? await this.apiClient.getBookReviews(canonicalID) : [];

    const publisher = this.determinePublisher(
      book.publisher,
      reviews.map(r => r.book.publisher)
    );

    const similarBooks = (book.similar_books && book.similar_books.book) || [];

    return {
      authors,
      averageRating: totalRatings > 0 ? ratingsSum / totalRatings : undefined,
      canonicalID: canonicalID || undefined,
      id,
      publisher: publisher || authors[0].name,
      shelves,
      similarBooks: similarBooks.map(b => b.id),
      title: normalizeString(book.title || work.original_title),
      topReviews: reviews.map(r => this.normalizeReview(r)),
      totalRatings,
      workID: work.id._
    };
  }

  /**
   * Determine the publisher of a book by taking the most popular publisher from
   * the book's official data and its reviews
   */
  private determinePublisher(official: string, fromReviews: string[]): string | undefined {
    const ranked = fromReviews.reduce(function(previous, publisher) {
      previous[publisher] = previous[publisher] || 0;
      previous[publisher]++;

      return previous;
    }, { [official]: 1 });

    const ordered = sortBy(
      Object.keys(ranked).filter(Boolean),
      [
        k => ranked[k] * -1,
        k => k
      ]
    );

    const publisher = ordered.shift();

    return publisher && normalizeString(publisher);
  }

  /**
   * Clean up a book's data based on the current configuration
   */
  private sanitizeBook(book: Book): Book {
    const { publisher, shelves } = book;
    const { ignoreShelves, mergePublishers, mergeShelves } = this.config;

    const excludeShelves = new Set([
      SHELVES.currentlyReading,
      SHELVES.toRead,
      ...ignoreShelves
    ]);

    const userShelves = shelves.filter(s => !excludeShelves.has(s.name));
    const mergedShelves = this.mergeShelves(userShelves, mergeShelves);

    return {
      ...book,
      publisher: publisher && this.mergePublishers(publisher, mergePublishers),
      shelves: sortBy(mergedShelves, [s => s.count * -1, s => s.name])
    };
  }

  /**
   * Merge publishers specified in a lookup
   */
  private mergePublishers(publisher: string, merge: Record<string, string[]>): string {
    const group = Object.keys(merge).find(function(name) {
      return merge[name].includes(publisher);
    });

    return group || publisher;
  }

  /**
   * Merge shelves specified in a lookup
   */
  private mergeShelves(shelves: Shelf[], merge: Record<string, string[]>): Shelf[] {
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
