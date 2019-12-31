import path from 'path';
import querystring from 'querystring';
import readline from 'readline';
import xml2js from 'xml2js';
import { chmod, readFile, unlink, writeFile } from 'graceful-fs';
import { OAuth } from 'oauth';
import { promisify } from 'util';
import { remove } from 'fs-extra';

import Logger from './logger';
import { readSecret } from './environment';

import {
  BookReviews,
  extractResponseBody,
  ResponseBody,
  UserResponse
} from './types/api';

import {
  Book,
  BookID,
  BookReview,
  UserID
} from './types/data';

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
  cacheDir: string;
  logger: Logger;
  sessionFile: string;
  useCache: boolean;
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

export default class APIClient {

  private lastRequest: number;
  private oauth: OAuth;
  private options: ClientOptions;
  private session?: Session;

  /**
   * Create a new interface to the Goodreads API
   */
  constructor(options: ClientOptions) {
    this.lastRequest = Date.now();
    this.oauth = createOAuthClient();
    this.options = options;
  }

  /**
   * Clear all cached data
   */
  clearCache(): Promise<void> {
    return remove(this.options.cacheDir);
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

    await writeFileAsync(this.options.sessionFile, JSON.stringify(session, null, 2));
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
   * Get information on a user's read books
   */
  async getReadBooks(userID: UserID): Promise<BookReview[]> {
    return await this.useCachedValue(`book-reviews.${userID}`, async () => {
      let page = 1;
      let fetching = true;

      const bookReviews: BookReview[] = [];

      while (fetching) {
        const rangeStart = (page - 1) * READ_BOOKS_PAGE_SIZE + 1;
        const rangeEnd = page * READ_BOOKS_PAGE_SIZE;

        this.options.logger.info(`Fetch read books for user ${userID}: ${rangeStart}–${rangeEnd}`);

        const response = await this.request('GET', 'review/list.xml', {
          id: userID,
          page,
          per_page: READ_BOOKS_PAGE_SIZE,
          shelf: 'read',
          v: 2
        });

        const { reviews } = BookReviews.conform(response);

        reviews.review.forEach(function(review) {
          bookReviews.push({
            bookID: review.book.id._,
            rating: parseInt(review.rating, 10)
          });
        });

        const { end, total } = reviews.$;

        if (total === '0' || end === total) {
          fetching = false;
        } else {
          page++;
        }
      }

      return bookReviews;
    });
  }

  /**
   * Get the current user's ID
   */
  async getUserID(): Promise<UserID> {
    const { userID } = await this.loadSession();
    return userID;
  }

  /**
   * Get the ID of the authorized user
   */
  private async getAuthorizedUserID(): Promise<UserID> {
    const response = await this.request('GET', 'api/auth_user');
    const data = UserResponse.conform(response);

    return data.user.$.id;
  }

  /**
   * Make a request to the Goodreads API
   */
  private async request(
    method: 'GET' | 'POST',
    relativeURL: string,
    payload?: object
  ): Promise<ResponseBody> {
    let response;

    const url = `${API_BASE_URL}/${relativeURL}`;

    switch (method) {
      case 'GET':
        response = await this.makeGetRequest(url, payload);
        break;

      case 'POST':
        response = await this.makePostRequest(url, payload);
        break;

      default:
        throw new Error(`Unhandled request type: ${method}`);
    }

    const parsed = await xml2js.parseStringPromise(response, {
      explicitArray: false
    });

    return extractResponseBody(parsed);
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

    await this.respectRateLimiting();

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

    await this.respectRateLimiting();

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
   * Prevent requests from being made too quickly
   */
  private async respectRateLimiting(): Promise<void> {
    const time = Date.now();
    const elapsed = time - this.lastRequest;

    if (elapsed < REQUEST_SPACING_MS) {
      await this.sleep(elapsed);
    }

    this.lastRequest = time;
  }

  /**
   * Read a value from the cache, or populate it if it is missing
   */
  private async useCachedValue<T>(
    key: string,
    computeValue: () => Promise<T>
  ): Promise<T> {
    if (!this.options.useCache) {
      return computeValue().then(function(value) {
        return value;
      });
    }

    const cacheFile = path.join(this.options.cacheDir, `${key}.json`);

    try {
      const cached = await readFileAsync(cacheFile, 'utf8');
      return JSON.parse(cached);
    } catch(error) {
      if (error.code === 'ENOENT') {
        const value = await computeValue();
        await writeFileAsync(cacheFile, JSON.stringify(value, null, 2));

        return value;
      } else {
        throw error;
      }
    }
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
