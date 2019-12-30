import path from 'path';
import querystring from 'querystring';
import readline from 'readline';
import xml2js from 'xml2js';
import { chmod, readFile, unlink, writeFile } from 'graceful-fs';
import { OAuth } from 'oauth';
import { promisify } from 'util';
import { remove } from 'fs-extra';

import { JSONSerializable } from './types/core';
import { readSecret } from './environment';

import {
  extractResponseBody,
  ResponseBody,
  UserResponse
} from './types/api';

const chmodAsync = promisify(chmod);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);
const writeFileAsync = promisify(writeFile);

const ACCESS_TOKEN_URL = 'http://www.goodreads.com/oauth/access_token';
const API_BASE_URL = 'https://www.goodreads.com';
const AUTHORIZE_URL = 'https://www.goodreads.com/oauth/authorize';
const REQUEST_TOKEN_URL = 'http://www.goodreads.com/oauth/request_token';

const REQUEST_SPACING_MS = 1000;

interface ClientOptions {
  cacheDir: string;
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

  private credentials?: OAuthCredentials;
  private lastRequest: number;
  private oauth: OAuth;
  private options: ClientOptions;
  private userID?: string;

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
    this.credentials = accessToken;

    const userID = await this.getUserID();

    const session: Session = {
      credentials: accessToken,
      userID
    };

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
  async getReadBooks(): Promise<void> {
    const response = await this.request('GET', 'review/list.xml', {
      per_page: 20,
      shelf: 'read',
      v: 2
    });

    console.error(JSON.stringify(response, null, 2)); // TODO: delete me
  }

  /**
   * Get the ID of the authorized user
   */
  private async getUserID(): Promise<string> {
    if (this.userID) {
      return Promise.resolve(this.userID);
    }

    const response = await this.request('GET', 'api/auth_user');
    const data = UserResponse.conform(response);
    const id = data.user.$.id;

    this.userID = id;

    return id;
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
    const { secret, token } = await this.getCredentials();

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
    const { secret, token } = await this.getCredentials();

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
  private async useCachedValue<T extends JSONSerializable>(
    key: string,
    computeValue: () => Promise<T>
  ): Promise<T> {
    if (!this.options.useCache) {
      return computeValue();
    }

    const cacheFile = path.join(this.options.cacheDir, `${key}.json`);

    try {
      const cached = await readFileAsync(cacheFile, 'utf8');
      return JSON.parse(cached);
    } catch(error) {
      if (error.code === 'ENOENT') {
        const value = await computeValue();
        await writeFileAsync(cacheFile, JSON.stringify(value));

        return value;
      } else {
        throw error;
      }
    }
  }

  /**
   * Get OAuth credentials for an authorized user
   */
  private async getCredentials(): Promise<OAuthCredentials> {
    if (this.credentials) {
      return Promise.resolve(this.credentials);
    }

    const session = await this.loadSession();
    this.credentials = session.credentials;

    return this.credentials;
  }

  /**
   * Load session information from the session file
   */
  private loadSession(): Promise<Session> {
    return readFileAsync(this.options.sessionFile, 'utf8').then(
      function(data) {
        return JSON.parse(data) as Session;
      }
    );
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
