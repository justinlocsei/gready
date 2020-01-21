import async from 'async';
import xml2js from 'xml2js';
import { range } from 'lodash';

import * as Normalized from './types/core';
import Cache from './cache';
import Logger from './logger';
import { ensureArray } from './util';
import { findReviewIDsForBook } from './reviews';
import { makeGetRequest } from './network';
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

const READ_BOOKS_PAGE_SIZE = 25;
const REQUEST_SPACING_MS = 1000;

interface ClientOptions {
  apiKey: string;
  cache: Cache;
  logger: Logger;
}

interface PendingRequest {
  execute: () => Promise<string>;
  handleResponse: (text: string) => void;
}

export default class APIClient {

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

    this.requestQueue = async.queue(async function(task, callback) {
      const text = await task.execute();
      task.handleResponse(text);

      callback();
    }, 1);
  }

  /**
   * Attempt to get the canonical ID of an existing book
   */
  async getCanonicalBookID(book: Normalized.Book): Promise<BookID | undefined> {
    const results = await this.options.cache.fetch(['book-search', book.id], async () => {
      const response = await this.request(
        ['Find book', book.title],
        'search/index.xml',
        {
          'search[field]': 'title',
          q: book.title
        }
      );

      return validateSearchResults(response);
    });

    const authorID = book.author.id;
    const works = ensureArray(results.search.results.work);
    const match = works.find(w => authorID === w.best_book.author.id._);

    return match && match.best_book.id._;
  }

  /**
   * Get information on a book using its Goodreads ID
   */
  getBook(id: BookID): Promise<Book> {
    return this.options.cache.fetch(['books', id], async () => {
      const response = await this.request(
        ['Fetch book', `ID=${id}`],
        'book/show.xml',
        {
          id,
          format: 'xml'
        }
      );

      return validateBookResponse(response).book;
    });
  }

  /**
   * Get information on a user's read books
   */
  getReadBooks(userID: UserID): Promise<ReadBook[]> {
    return this.options.cache.fetch(['read-books', userID], async () => {
      const readBooks: ReadBook[] = [];

      const check = await this.fetchReadBooksPage(['Check read books', `UserID=${userID}`], userID);
      const totalBooks = parseInt(check.reviews.$.total, 10);

      if (!totalBooks) {
        return readBooks;
      }

      await runSequence(
        ['Fetch read books', `UserID=${userID}`],
        range(1, Math.ceil(totalBooks / READ_BOOKS_PAGE_SIZE) + 1),
        this.options.logger,
        async (page) => {
          const { reviews } = await this.fetchReadBooksPage(
            [
              'Fetch read-books page',
              `From=${(page - 1) * READ_BOOKS_PAGE_SIZE + 1}`,
              `To=${Math.min(totalBooks, page * READ_BOOKS_PAGE_SIZE)}`
            ],
            userID,
            page
          );

          reviews.review.forEach(function(review) {
            readBooks.push(review);
          });
        }
      );

      return readBooks;
    });
  }

  /**
   * Get information on a review
   */
  getReview(id: ReviewID): Promise<Review> {
    return this.options.cache.fetch(['reviews', id], async () => {
      const response = await this.request(
        ['Fetch review', `ID=${id}`],
        'review/show.xml',
        {
          id,
          format: 'xml'
        }
      );

      return validateReviewResponse(response).review;
    });
  }

  /**
   * Extract reviews of a book with a given identifier
   */
  async getBookReviews(id: BookID, {
    limit,
    rating
  }: {
    limit?: number;
    rating?: number;
  } = {}): Promise<Review[]> {
    const message = [
      `Book=${id}`,
      `Rating=${rating || 'any'}`,
      `Limit=${limit || 'none'}`
    ];

    const reviewIDs = await this.options.cache.fetch(
      ['review-ids', id, rating || 'all', limit || 'all'],
      () => {
        this.options.logger.debug('Fetch review IDs', ...message);
        return findReviewIDsForBook(id, { limit, rating });
      }
    );

    return runSequence(
      ['Load reviews', ...message],
      reviewIDs,
      this.options.logger,
      async id => this.getReview(id)
    );
  }

  /**
   * Fetch a page of reviews
   */
  private async fetchReadBooksPage(message: string[], userID: UserID, page = 1): Promise<ReadBooksResponse> {
    const response = await this.request(
      message,
      'review/list.xml',
      {
        id: userID,
        page,
        per_page: READ_BOOKS_PAGE_SIZE,
        shelf: 'read',
        v: 2
      }
    );

    return validateReadBooksResponse(response);
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

    return validateResponse(parsed).GoodreadsResponse;
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
        const delay = REQUEST_SPACING_MS - elapsed
        logger.debug(...requestMessage, `Wait ${delay}ms`);

        await this.sleep(delay);
      }

      this.lastRequestTime = time;

      logger.info(...apiMessage);

      return requestFn();
    };

    logger.debug(...requestMessage, 'Enqueue');

    return new Promise(resolve => {
      this.requestQueue.push({
        execute,
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
