import path from 'path';
import querystring from 'querystring';
import readline from 'readline';
import xml2js from 'xml2js';
import { chmod, readFile, writeFile } from 'graceful-fs';
import { OAuth } from 'oauth';
import { promisify } from 'util';

import { readSecret } from './environment';

import {
  extractResponseBody,
  ResponseBody,
  ShelvesResponse,
  UserResponse
} from './api-responses';

const chmodAsync = promisify(chmod);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const ACCESS_TOKEN_URL = 'http://www.goodreads.com/oauth/access_token';
const API_BASE_URL = 'https://www.goodreads.com';
const AUTHORIZE_URL = 'https://www.goodreads.com/oauth/authorize';
const REQUEST_TOKEN_URL = 'http://www.goodreads.com/oauth/request_token';

interface OAuthCredentials {
  secret: string;
  token: string;
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

  private authFile: string;
  private cacheDir: string;
  private credentials?: OAuthCredentials;
  private oauth: OAuth;
  private userID?: string;

  /**
   * Create a new interface to the Goodreads API
   */
  constructor({
    cacheDir
  }: {
    cacheDir: string;
  }) {
    this.authFile = path.join(cacheDir, 'auth.json');
    this.cacheDir = cacheDir;
    this.oauth = createOAuthClient();
  }

  /**
   * Get the ID of the authorized user
   */
  async getUserID(): Promise<string> {
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
   * Make a GET request to the Goodreads API
   */
  private async makeGetRequest(
    url: string,
    payload?: Record<string, any>
  ): Promise<string> {
    const { secret, token } = await this.getCredentials();

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
   * Get OAuth credentials for an authorized user
   */
  private async getCredentials(): Promise<OAuthCredentials> {
    if (this.credentials) {
      return Promise.resolve(this.credentials);
    }

    const stored = await this.loadStoredCredentials();

    if (stored !== null) {
      return stored;
    }

    const requestToken = await this.generateReqestToken();
    await this.waitForAuthorization(requestToken.token);

    const accessToken = await this.getAccessToken(requestToken);
    await writeFileAsync(this.authFile, JSON.stringify(accessToken));
    await chmodAsync(this.authFile, 0o600);

    return accessToken;
  }

  /**
   * Attempt to load credentials from a local file
   */
  private loadStoredCredentials(): Promise<OAuthCredentials | null> {
    return readFileAsync(this.authFile, 'utf8').then(
      function(data) {
        return JSON.parse(data) as OAuthCredentials;
      },
      function(error: NodeJS.ErrnoException) {
        if (error.code === 'ENOENT') {
          return null;
        } else {
          throw error;
        }
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
