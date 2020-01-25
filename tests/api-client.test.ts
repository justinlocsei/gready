import { uniq } from 'lodash';

import assert from './helpers/assert';
import APIClient from '../src/api-client';
import Cache from '../src/cache';
import { configureNetworkAccess, simulateResponse } from './helpers/requests';
import { canUpdateFixtures, createTestLogger } from './helpers';
import { createBook } from './helpers/factories';
import { getGoodreadsAPIKey, hasGoodreadsAPIKey } from '../src/config';
import { paths } from '../src/environment';
import { URLS } from '../src/goodreads';

describe('api-client', function() {

  describe('APIClient', function() {

    configureNetworkAccess(this, {
      allowRequests: canUpdateFixtures() && hasGoodreadsAPIKey(),
      timeout: 20000,
      useFixtures: false
    });

    function createClient(): APIClient {
      const cache = new Cache(paths.apiFixturesDir, {
        enabled: true,
        encoding: 'base64'
      });

      return new APIClient({
        apiKey: getGoodreadsAPIKey(),
        cache,
        logger: createTestLogger()[0]
      });
    }

    describe('.getBook', function() {

      it('gets information on a book using its ID', async function() {
        const book = await createClient().getBook('1');
        assert.equal(book.id, '1');
      });

    });

    describe('.getBookReviews', function() {

      it('gets reviews for a book using its ID', async function() {
        const reviews = await createClient().getBookReviews('0439785960', { limit: 2 });
        const workIDs = reviews.map(r => r.book.work.id).filter(Boolean);

        assert.equal(reviews.length, 2);
        assert.equal(workIDs.length, 2);
        assert.equal(uniq(workIDs).length, 1);
      });

      it('respects the limit for reviews', async function() {
        const reviews = await createClient().getBookReviews('0439785960', { limit: 1 });
        assert.equal(reviews.length, 1);
      });

      it('can filter reviews by rating', async function() {
        const oneStar = await createClient().getBookReviews('0439785960', { limit: 2, rating: 1 });
        const fiveStar = await createClient().getBookReviews('0439785960', { limit: 2, rating: 5 });

        assert.deepEqual(oneStar.map(r => r.rating), ['1', '1']);
        assert.deepEqual(fiveStar.map(r => r.rating), ['5', '5']);
      });

    });

    describe('.getCanonicalBookID', function() {

      it('returns the ID of the book that most closely matches the given book', async function() {
        const book = createBook({
          author: {
            id: '1077326',
            name: 'Name'
          },
          id: '28139880',
          title: 'Harry Potter and the Half-Blood Prince (Harry Potter, #6)'
        });

        assert.equal(await createClient().getCanonicalBookID(book), '1');
      });

      it('accounts for the author ID when searching for a book', async function() {
        const book = createBook({
          author: {
            id: '1',
            name: 'Invalid'
          },
          id: '28139880',
          title: 'Harry Potter and the Half-Blood Prince (Harry Potter, #6)'
        });

        assert.isNull(await createClient().getCanonicalBookID(book));
      });

    });

    describe('.getReadBooks', function() {

      it('returns information on a user’s read books', async function() {
        const readBooks = await createClient().getReadBooks('4');
        const books = readBooks.map(r => r.book.id._).filter(Boolean);

        assert.isNotEmpty(readBooks);
        assert.equal(books.length, readBooks.length);
        assert.deepEqual(uniq(books), books);
      });

      it('supports a custom page size', async function() {
        const withoutLimit = await createClient().getReadBooks('4');
        assert.isAbove(withoutLimit.length, 2);

        const withLimit = await createClient().getReadBooks('4', { pageSize: 2 });
        assert.deepEqual(withoutLimit, withLimit);
      });

      it('handles an empty list of read books', async function() {
        assert.isEmpty(await createClient().getReadBooks('10'));
      });

      it('raises an error when an invalid Goodreads user ID is provided', function() {
        return simulateResponse(URLS.apiBase, 404, async function() {
          await assert.isRejected(
            createClient().getReadBooks('---'),
            /Invalid Goodreads user ID: ---/
          );
        });
      });

    });

  });

});
