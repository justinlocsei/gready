import { sortBy } from 'lodash';

import * as API from './types/api';
import APIClient from './api-client';
import Cache from './cache';
import Logger from './logger';
import { Configuration } from './types/config';
import { CORE_SHELVES } from './config';
import { ensureArray, normalizeString } from './data';

import {
  Author,
  Book,
  Review,
  Shelf
} from './types/data';

import {
  BookID,
  UserID
} from './types/goodreads';

const NAMESPACES = {
  books: 'books',
  readBooks: 'read-books'
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
    return this.cache.fetch([NAMESPACES.books, id], async () => {
      const book = await this.apiClient.getBook(id);
      this.logger.debug('Normalize book', `ID=${book.id}`);

      return this.normalizeBookInfo(book);
    }).then(b => this.sanitizeBook(b));
  }

  /**
   * Get information on all books in a list that are locally available
   */
  async getLocalBooks(ids: BookID[]): Promise<Book[]> {
    const books = await this.cache.entries<Book>([NAMESPACES.books])

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
  getReadBooks(userID: UserID): Promise<Review[]> {
    return this.cache.fetch([NAMESPACES.readBooks, userID], async () => {
      const books = await this.apiClient.getReadBooks(userID);

      return sortBy(
        books.map(b => this.normalizeReview(b)),
        [
          b => b.posted * -1,
          b => b.bookID
        ]
      );
    });
  }

  /**
   * Convert a review from the API to a book review
   */
  private normalizeReview(review: API.Review): Review {
    const shelves = ensureArray(review.shelves.shelf).map(function(shelf): string {
      return shelf.$.name;
    });

    return {
      bookID: review.book.id._,
      id: review.id,
      posted: new Date(review.read_at || review.date_added).getTime(),
      rating: parseInt(review.rating, 10),
      shelves,
      userID: review.user.id
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

    const reviews = await this.apiClient.getBookReviews(book.id);
    const topReviews = reviews.map(this.normalizeReview);

    const publisher = this.determinePublisher(
      book.publisher,
      reviews.map(r => r.book.publisher)
    );

    const similarBooks = (book.similar_books && book.similar_books.book) || [];

    return {
      authors,
      averageRating: totalRatings > 0 ? ratingsSum / totalRatings : undefined,
      id,
      publisher: publisher || authors[0].name,
      shelves,
      similarBooks: similarBooks.map(b => b.id),
      title: normalizeString(book.title || work.original_title),
      topReviews,
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

    const excludeShelves = new Set([...CORE_SHELVES, ...ignoreShelves]);
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
