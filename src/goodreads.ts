import querystring from 'querystring';
import { URL } from 'url';

import { UserID } from './types/goodreads';

export const SHELVES = {
  currentlyReading: 'currently-reading',
  read: 'read',
  toRead: 'to-read'
};

const HTTP = 'http://www.goodreads.com';
const HTTPS = 'https://www.goodreads.com';

export const URLS = {
  accessToken: `${HTTP}/oauth/access_token`,
  apiBase: HTTPS,
  authorize: `${HTTPS}/oauth/authorize`,
  requestToken: `${HTTP}/oauth/request_token`,
  reviewsWidget: `${HTTPS}/api/reviews_widget_iframe`,
  viewBooks: `${HTTPS}/review/list`
};

/**
 * Get the URL for viewing a user's books
 */
export function getUserBooksURL(id: UserID): string {
  const url = new URL(`${URLS.viewBooks}/${id}`);

  url.search = querystring.stringify({
    order: 'd',
    sort: 'avg_rating',
    shelf: SHELVES.read
  });

  return url.toString();
}
