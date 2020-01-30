import async from 'async';
import xml2js from 'xml2js';
import { range } from 'lodash';

import * as Normalized from './types/core';
import Cache, { KeyPath } from './cache';
import Logger from './logger';
import { ensureArray } from './util';
import { findPartialReviewsForBook } from './reviews';
import { makeGetRequest } from './network';
import { NetworkError, OperationalError } from './errors';
import { runSequence } from './flow';
import { URLS } from './goodreads';

import {
  validateBookResponse,
  validateReadBooksResponse,
  validateResponse,
  validateReviewResponse,
  validateSearchResults
} from './validators/api';

import {
  Book,
  ReadBook,
  ReadBooksResponse,
  ResponseBody,
  Review
} from './types/api';

import {
  BookID,
  ReviewID,
  UserID
} from './types/goodreads';

const REQUEST_SPACING_MS = 1000;

interface ClientOptions {
  apiKey: string;
  cache: Cache;
  logger: Logger;
}

interface PendingRequest {
  execute: () => Promise<string>;
  handleError: (error: any) => void;
  handleResponse: (text: string) => void;
}

export default class APIClient {

  readonly cache: Cache;
  readonly logger: Logger;

  private lastRequestID: number;
  private lastRequestTime: number;
  private options: ClientOptions;
  private requestQueue: async.AsyncQueue<PendingRequest>;

  /**
   * Create a new interface to the Goodreads API
   */
  constructor(options: ClientOptions) {
    this.lastRequestID = 0;
    this.lastRequestTime = Date.now();
    this.options = options;

    this.cache = options.cache;
    this.logger = options.logger;

    this.requestQueue = async.queue(async function(task, callback) {
      let text: string | undefined;

      try {
        text = await task.execute();
      } catch (error) {
        task.handleError(error);
      }

      if (text !== undefined) {
        task.handleResponse(text);
      }

      callback();
    }, 1);
  }

  /**
   * Get information on a book using its Goodreads ID
   */
  async getBook(id: BookID): Promise<Book> {
    const response = await this.requestWithCache(
      ['books', id],
      ['Fetch book', `ID=${id}`],
      'book/show.xml',
      {
        id,
        format: 'xml'
      }
    );

    return validateBookResponse(response).book;
  }

  /**
   * Extract reviews of a book with a given identifier
   */
  async getBookReviews(bookID: BookID, {
    limit,
    rating
  }: {
    limit: number;
    rating?: number;
  }): Promise<Review[]> {
    const message = [
      `Book=${bookID}`,
      `Rating=${rating || 'any'}`,
      `Limit=${limit}`
    ];

    const reviews = await this.cache.fetch(
      ['review-meta', bookID, rating || 'all', limit],
      () => {
        this.logger.debug('Fetch review metadata', ...message);
        return findPartialReviewsForBook(bookID, { limit, rating });
      }
    );

    return runSequence(
      ['Load reviews', ...message],
      reviews,
      this.logger,
      async ({ id }) => this.getReview(id)
    );
  }

  /**
   * Attempt to get the canonical ID of an existing book
   */
  async getCanonicalBookID(book: Normalized.Book): Promise<BookID | null> {
    const response = await this.requestWithCache(
      ['book-search', book.id],
      ['Find book', book.title],
      'search/index.xml',
      {
        'search[field]': 'title',
        q: book.title
      }
    );

    const results = validateSearchResults(response);

    const match = ensureArray(results.search.results.work).find(function(work) {
      return book.author.id === work.best_book.author.id._;
    });

    return match ? match.best_book.id._ : null;
  }

  /**
   * Get information on a user's read books
   */
  async getReadBooks(
    userID: UserID,
    options: { pageSize?: number; } = {}
  ): Promise<ReadBook[]> {
    const readBooks: ReadBook[] = [];
    const pageSize = options.pageSize || 25;

    const check = await this.fetchReadBooksPage(
      ['Check read books', `UserID=${userID}`],
      userID,
      pageSize
    ).catch(function(error) {
      if (error instanceof NetworkError && error.statusCode === 404) {
        throw new OperationalError(`Invalid Goodreads user ID: ${userID}`);
      } else {
        throw error;
      }
    });

    const totalBooks = parseInt(check.reviews.$.total, 10);

    if (!totalBooks) {
      return readBooks;
    }

    await runSequence(
      ['Fetch read books', `UserID=${userID}`],
      range(1, Math.ceil(totalBooks / pageSize) + 1),
      this.logger,
      async (page) => {
        const { reviews } = await this.fetchReadBooksPage(
          [
            'Fetch read-books page',
            `From=${(page - 1) * pageSize + 1}`,
            `To=${Math.min(totalBooks, page * pageSize)}`
          ],
          userID,
          pageSize,
          page
        );

        ensureArray(reviews.review || []).forEach(function(review) {
          readBooks.push(review);
        });
      }
    );

    return readBooks;
  }

  /**
   * Get information on a review
   */
  private async getReview(id: ReviewID): Promise<Review> {
    const response = await this.requestWithCache(
      ['reviews', id],
      ['Fetch review', `ID=${id}`],
      'review/show.xml',
      {
        id,
        format: 'xml'
      }
    );

    return validateReviewResponse(response).review;
  }

  /**
   * Fetch a page of reviews
   */
  private async fetchReadBooksPage(message: string[], userID: UserID, pageSize: number, page = 1): Promise<ReadBooksResponse> {
    const response = await this.requestWithCache(
      ['read-books', userID, pageSize, page],
      message,
      'review/list.xml',
      {
        id: userID,
        page,
        per_page: pageSize,
        shelf: 'read',
        v: 2
      }
    );

    return validateReadBooksResponse(response);
  }

  /**
   * Make a cached request to the Goodreads API and cache its response
   */
 private async requestWithCache(
   cacheKey: KeyPath,
   ...request: Parameters<APIClient['request']>
 ): Promise<ResponseBody> {
   return this.cache.fetch(cacheKey, () => {
     return this.request(...request);
   });
 }

  /**
   * Make a request to the Goodreads API
   */
  private async request(
    message: string[],
    relativeURL: string,
    payload: object = {}
  ): Promise<ResponseBody> {
    const url = `${URLS.apiBase}/${relativeURL}`;

    const response = await this.executeRequest(message, () => {
      return makeGetRequest(url, {
        key: this.options.apiKey,
        ...payload
      });
    });

    const parsed = await xml2js.parseStringPromise(response, {
      explicitArray: false
    });

    const validated = validateResponse(parsed).GoodreadsResponse;

    delete validated.Request;

    return validated;
  }

  /**
   * Execute a single HTTP request
   */
  private executeRequest(
    message: string[],
    requestFn: () => Promise<string>
  ): Promise<string> {
    const { logger } = this.options;

    const requestID = ++this.lastRequestID;
    const apiMessage = ['API', ...message];
    const requestMessage = [...apiMessage, `RequestID=${requestID}`];

    const execute = async () => {
      logger.debug(...requestMessage, 'Process');

      const time = Date.now();
      const elapsed = time - this.lastRequestTime;

      if (elapsed < REQUEST_SPACING_MS) {
        const delay = REQUEST_SPACING_MS - elapsed;
        logger.debug(...requestMessage, `Wait ${delay}ms`);

        await this.sleep(delay);
      }

      this.lastRequestTime = time;

      logger.info(...apiMessage);

      return requestFn();
    };

    logger.debug(...requestMessage, 'Enqueue');

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        execute,
        handleError: (error: any) => {
          reject(error);
        },
        handleResponse: (text: string) => {
          logger.debug(...requestMessage, 'Handle response');
          logger.debug(...requestMessage, `RemainingRequests=${this.requestQueue.length()}`);
          resolve(text);
        }
      });
    });
  }

  /**
   * Sleep for an arbitrary number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

}
