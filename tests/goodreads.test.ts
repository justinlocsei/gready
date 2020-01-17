import { URL } from 'url';

import assert from './assert';

import {
  getUserBooksURL,
  getViewBookURL,
  URLS
} from '../src/goodreads';

describe('goodreads/URLS', function() {

  it('is a map of labels to absolute URLs', function() {
    const urls = Object.values(URLS);

    assert.isNotEmpty(urls);

    urls.forEach(function(url) {
      const parsed = new URL(url);

      assert.match(parsed.protocol, /https?\:/);
      assert.match(parsed.host, /goodreads\.com/);
    });
  });

});

describe('goodreads/getUserBooksURL', function() {

  it('returns a URL for viewing a user’s books', function() {
    assert.equal(
      getUserBooksURL('25'),
      'https://www.goodreads.com/review/list/25?order=d&sort=avg_rating&shelf=read'
    );
  });

});

describe('goodreads/getViewBookURL', function() {

  it('returns a URL for viewing a book', function() {
    assert.equal(
      getViewBookURL('25'),
      'https://www.goodreads.com/book/show/25'
    );
  });

});
