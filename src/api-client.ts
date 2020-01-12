import async from 'async';
import querystring from 'querystring';
import readline from 'readline';
import xml2js from 'xml2js';
import { chmod, readFile, unlink, writeFile } from 'graceful-fs';
import { OAuth } from 'oauth';
import { promisify } from 'util';

import Cache from './cache';
import Logger from './logger';
import { findReviewIDsForBook } from './reviews';
import { formatJSON } from './serialization';
import { readSecret } from './environment';

import {
  Book,
  BookSchema,
  extractResponseBody,
  ReadBooks,
  ReadBooksSchema,
  ResponseBody,
  Review,
  ReviewSchema,
  UserDataSchema
} from './types/api';

import {
  BookID,
  ReviewID,
  UserID
} from './types/goodreads';

const chmodAsync = promisify(chmod);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);
const writeFileAsync = promisify(writeFile);

const ACCESS_TOKEN_URL = 'http://www.goodreads.com/oauth/access_token';
const API_BASE_URL = 'https://www.goodreads.com';
const AUTHORIZE_URL = 'https://www.goodreads.com/oauth/authorize';
const REQUEST_TOKEN_URL = 'http://www.goodreads.com/oauth/request_token';

const READ_BOOKS_PAGE_SIZE = 25;
const REQUEST_SPACING_MS = 1000;

interface ClientOptions {
  cache: Cache;
  logger: Logger;
  sessionFile: string;
}

interface OAuthCredentials {
  secret: string;
  token: string;
}

interface Session {
  credentials: OAuthCredentials;
  userID: string;
}

/**
 * Create an OAuth client for the current environment
 */
function createOAuthClient(): OAuth {
  return new OAuth(
    REQUEST_TOKEN_URL,
    ACCESS_TOKEN_URL,
    readSecret('GREADY_GOODREADS_KEY'),
    readSecret('GREADY_GOODREADS_SECRET'),
    '1.0',
    null,
    'HMAC-SHA1'
  );
}

interface PendingRequest {
  execute: () => Promise<string>;
  handleResponse: (text: string) => void;
}

export default class APIClient {

  private lastRequestID: number;
  private lastRequestTime: number;
  private oauth: OAuth;
  private options: ClientOptions;
  private requestQueue: async.AsyncQueue<PendingRequest>;
  private session?: Session;

  /**
   * Create a new interface to the Goodreads API
   */
  constructor(options: ClientOptions) {
    this.lastRequestID = 0;
    this.lastRequestTime = Date.now();
    this.oauth = createOAuthClient();
    this.options = options;

    this.requestQueue = async.queue(async function(task, callback) {
      const text = await task.execute();
      task.handleResponse(text);

      callback();
    }, 1);
  }

  /**
   * Log a user in and store their session information
   */
  async logIn(): Promise<string> {
    const requestToken = await this.generateReqestToken();
    await this.waitForAuthorization(requestToken.token);

    const accessToken = await this.getAccessToken(requestToken);
    const userID = await this.getAuthorizedUserID();

    const session: Session = {
      credentials: accessToken,
      userID
    };

    this.session = session;

    await writeFileAsync(this.options.sessionFile, formatJSON(session));
    await chmodAsync(this.options.sessionFile, 0o600);

    return userID;
  }

  /**
   * Remove any stored session information
   */
  logOut(): Promise<void> {
    return unlinkAsync(this.options.sessionFile).then(
      () => undefined,
      function(error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    );
  }

  /**
   * Get information on a book using its Goodreads ID
   */
  getBook(id: BookID): Promise<Book> {
    return this.options.cache.fetch(['books', id], async () => {
      const response = await this.request(
        ['Fetch book', `ID=${id}`],
        'GET',
        'book/show.xml',
        {
          id,
          format: 'xml'
        }
      );

      return BookSchema.conform(response).book;
    });
  }

  /**
   * Get information on a user's read books
   */
  getReadBooks(userID: UserID): Promise<Review[]> {
    return this.options.cache.fetch(['read-books', userID], async () => {
      let page = 1;
      let fetching = true;

      const readBooks: Review[] = [];

      const { reviews: { $: { total } } } = await this.fetchReadBooksPage(
        ['Check read books', `UserID=${userID}`],
        userID
      );

      const totalBooks = parseInt(total, 10);

      while (fetching) {
        const rangeStart = (page - 1) * READ_BOOKS_PAGE_SIZE + 1;
        const rangeEnd = Math.min(page * READ_BOOKS_PAGE_SIZE, totalBooks);

        const { reviews } = await this.fetchReadBooksPage(
          [
            'Fetch read books',
            `UserID=${userID}`,
            `Total=${totalBooks}`,
            `Start=${rangeStart}`,
            `End=${rangeEnd}`
          ],
          userID,
          page
        );

        reviews.review.forEach(function(review) {
          readBooks.push(review);
        });

        const { end } = reviews.$;

        if (total === '0' || end === total) {
          fetching = false;
        } else {
          page++;
        }
      }

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
        'GET',
        'review/show.xml',
        {
          id,
          format: 'xml'
        });

      return ReviewSchema.conform(response).review;
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
    const reviewIDs = await this.options.cache.fetch(
      ['review-ids', id, rating || 'all', limit || 'all'],
      () => {
        this.options.logger.debug('Request review IDs', `Book=${id}`);
        return findReviewIDsForBook(id, { limit, rating });
      }
    );

    return Promise.all(reviewIDs.map(async (id): Promise<Review> => {
      return this.getReview(id);
    }));
  }

  /**
   * Get the current user's ID
   */
  getUserID(): Promise<UserID> {
    return this.loadSession().then(s => s.userID);
  }

  /**
   * Fetch a page of reviews
   */
  private async fetchReadBooksPage(message: string[], userID: UserID, page = 1): Promise<ReadBooks> {
    const response = await this.request(
      message,
      'GET',
      'review/list.xml',
      {
        id: userID,
        page,
        per_page: READ_BOOKS_PAGE_SIZE,
        shelf: 'read',
        v: 2
      }
    );

    return ReadBooksSchema.conform(response);
  }

  /**
   * Get the ID of the authorized user
   */
  private async getAuthorizedUserID(): Promise<UserID> {
    const response = await this.request(['Get authorized user ID'], 'GET', 'api/auth_user');
    const data = UserDataSchema.conform(response);

    return data.user.$.id;
  }

  /**
   * Make a request to the Goodreads API
   */
  private async request(
    message: string[],
    method: 'GET' | 'POST',
    relativeURL: string,
    payload?: object
  ): Promise<ResponseBody> {
    const url = `${API_BASE_URL}/${relativeURL}`;

    const response = await this.executeRequest(message, () => {
      switch (method) {
        case 'GET':
          return this.makeGetRequest(url, payload);
        case 'POST':
          return this.makePostRequest(url, payload);
      }
    });

    const parsed = await xml2js.parseStringPromise(response, {
      explicitArray: false
    });

    return extractResponseBody(parsed);
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
    const requestMessage = [...message, `RequestID=${requestID}`];

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

      logger.info(...message);

      return requestFn();
    };

    logger.debug(...requestMessage, 'Enqueue');

    return new Promise(resolve => {
      this.requestQueue.push({
        execute,
        handleResponse: function(text: string) {
          logger.debug(...requestMessage, 'Handle response');
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

  /**
   * Make a GET request to the Goodreads API
   */
  private async makeGetRequest(
    url: string,
    payload?: Record<string, any>
  ): Promise<string> {
    const { credentials: { secret, token } } = await this.loadSession();

    let endpoint = url;

    if (payload) {
      endpoint = `${endpoint}?${querystring.stringify(payload)}`;
    }

    return new Promise((resolve, reject) => {
      this.oauth.get(endpoint, token, secret, function(error, result) {
        if (error) {
          reject(new Error(`GET request to ${endpoint} failed with code ${error.statusCode}`));
        } else {
          resolve(result ? result.toString() : '');
        }
      });
    });
  }

  /**
   * Make a POST request to the Goodreads API
   */
  private async makePostRequest(
    url: string,
    payload?: Record<string, any>
  ): Promise<string> {
    const { credentials: { secret, token } } = await this.loadSession();

    return new Promise((resolve, reject) => {
      this.oauth.post(url, token, secret, payload || {}, 'application/x-www-form-urlencoded', function(error, result) {
        if (error) {
          reject(new Error(`POST request to ${url} failed with code ${error.statusCode}`));
        } else {
          resolve(result ? result.toString() : '');
        }
      });
    });
  }

  /**
   * Load session information from the session file
   */
  private async loadSession(): Promise<Session> {
    if (this.session) {
      return Promise.resolve(this.session);
    }

    const text = await readFileAsync(this.options.sessionFile, 'utf8');
    const session: Session = JSON.parse(text);

    this.session = session;

    return session;
  }

  /**
   * Generate an OAuth request token
   */
  private generateReqestToken(): Promise<OAuthCredentials> {
    return new Promise((resolve, reject) => {
      this.oauth.getOAuthRequestToken(function(error, token, secret) {
        if (error) {
          reject(new Error(`Request for request token failed with code ${error.statusCode}`));
        } else {
          resolve({ secret, token });
        }
      });
    });
  }

  /**
   * Convert an OAuth request token to an access token
   */
  private getAccessToken(requestData: OAuthCredentials): Promise<OAuthCredentials> {
    const { secret, token } = requestData;

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthAccessToken(token, secret, '', function(error, accessToken, accessSecret) {
        if (error) {
          reject(new Error(`Request for access token failed with code ${error.statusCode}`));
        } else {
          resolve({
            secret: accessSecret,
            token: accessToken
          });
        }
      });
    });
  }

  /**
   * Wait for the user to grant access to their account in Goodreads
   */
  private waitForAuthorization(requestToken: string): Promise<void> {
    const prompt = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const payload = querystring.stringify({ oauth_token: requestToken });

    return new Promise(function(resolve, reject) {
      prompt.question(
        `Visit ${AUTHORIZE_URL}?${payload} to authenticate, then press enter`,
        function() {
          prompt.close();
          resolve();
        }
      );
    });
  }

}
