import async from 'async';
import xml2js from 'xml2js';
import { range } from 'lodash';

import { Cache, KeyPath } from './cache';
import { ensureArray } from './util';
import { findPartialReviewsForBook } from './reviews';
import { handleRequestErrors, makeGetRequest } from './network';
import { Logger } from './logger';
import { NetworkError, OperationalError } from './errors';
import { runSequence } from './flow';
import { URLS } from './goodreads';

import {
  validateBookResponse,
  validateReadBooksResponse,
  validateResponse,
  validateReviewResponse
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

interface APIClientOptions {
  apiKey: string;
  cache: Cache;
  logger: Logger;
}

interface PendingRequest {
  execute: () => Promise<string>;
  handleError: (error: any) => void;
  handleResponse: (text: string) => void;
}

class APIClientClass {

  readonly cache: Cache;
  readonly logger: Logger;

  private lastRequestID: number;
  private lastRequestTime: number;
  private options: APIClientOptions;
  private requestQueue: async.AsyncQueue<PendingRequest>;

  /**
   * Create a new interface to the Goodreads API
   */
  constructor(options: APIClientOptions) {
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

    const partialReviews = await this.cache.fetch(
      ['review-meta', bookID, rating || 'all', limit],
      () => {
        this.logger.debug('Fetch review metadata', ...message);
        return findPartialReviewsForBook(bookID, { limit, rating });
      }
    );

    const reviews: Review[] = [];

    await runSequence(
      ['Load reviews', ...message],
      partialReviews,
      this.logger,
      ({ id }) => {
        return handleRequestErrors(
          async () => reviews.push(await this.getReview(id)),
          async error => this.logger.warn(`Skipping review ${id} due to network error: ${error.statusCode}`)
        );
      }
    );

    return reviews;
  }

  /**
   * Get information on a user's read books
   */
  async getReadBooks(
    userID: UserID,
    options: {
      limit?: number;
      pageSize?: number;
    } = {}
  ): Promise<ReadBook[]> {
    const readBooks: ReadBook[] = [];
    const pageSize = options.pageSize || 25;
    const { limit } = options;

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

    const targetBooks = limit !== undefined
      ? Math.min(limit, totalBooks)
      : totalBooks;

    await runSequence(
      ['Fetch read books', `UserID=${userID}`],
      range(1, Math.ceil(targetBooks / pageSize) + 1),
      this.logger,
      async (page) => {
        const { reviews } = await this.fetchReadBooksPage(
          [
            'Fetch read-books page',
            `From=${(page - 1) * pageSize + 1}`,
            `To=${Math.min(targetBooks, page * pageSize)}`
          ],
          userID,
          pageSize,
          page
        );

        ensureArray(reviews.review).forEach(function(review) {
          readBooks.push(review);
        });
      }
    );

    return limit !== undefined ? readBooks.slice(0, limit) : readBooks;
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
    payload: object
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

export type APIClient = InstanceType<typeof APIClientClass>;

/**
 * Create an API client
 */
export function createAPIClient(options: APIClientOptions): APIClient {
  return new APIClientClass(options);
}
