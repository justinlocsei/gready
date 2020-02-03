import fs from 'fs-extra';
import path from 'path';
import { uniq } from 'lodash';

import * as reviews from '../../src/reviews';
import assert from '../helpers/assert';
import { allowNetworkAccess, simulateResponse } from '../helpers/requests';
import { allowOverrides } from '../helpers/mocking';
import { APIClient, createAPIClient } from '../../src/api-client';
import { canAttemptNetworkAccess, createTestLogger, shouldBypassFixtures } from '../helpers';
import { createCache } from '../../src/cache';
import { getGoodreadsAPIKey, hasGoodreadsAPIKey } from '../../src/config';
import { paths } from '../../src/environment';
import { URLS } from '../../src/goodreads';

describe('api-client', function() {

  const { override } = allowOverrides(this);

  describe('APIClient', function() {

    allowNetworkAccess(this, {
      timeout: 20000,
      useFixtures: false,
      when: hasGoodreadsAPIKey
    });

    function createClient(): APIClient {
      const cache = createCache(paths.apiFixturesDir, {
        enabled: !shouldBypassFixtures(),
        encoding: 'base64'
      });

      return createAPIClient({
        apiKey: canAttemptNetworkAccess() ? getGoodreadsAPIKey() : 'key',
        cache,
        logger: createTestLogger()[0]
      });
    }

    describe('.getBook', function() {

      function getMockedBook(runTest: () => Promise<void>): Promise<void> {
        return simulateResponse(
          URLS.apiBase,
          {
            body: fs.readFileSync(
              path.join(paths.testFixturesDir, 'goodreads', 'book.xml'),
              'utf8'
            ),
            headers: {
              'Content-Type': 'application/xml'
            },
            status: 200
          },
          runTest
        );
      }

      it('gets information on a book using its ID', async function() {
        const book = await createClient().getBook('1');
        assert.equal(book.id, '1');
      });

      it('can parse the structure of a book response', function() {
        return getMockedBook(async function() {
          const client = createClient();
          client.cache.isEnabled = false;

          const book = await client.getBook('1');
          assert.isDefined(book.id);
        });
      });

      it('throttles requests', function() {
        return getMockedBook(async function() {
          const client = createClient();
          client.cache.isEnabled = false;

          const startTime = Date.now();

          await client.getBook('1');
          await client.getBook('1');

          assert.isAtLeast(Date.now() - startTime, 1000);
        });
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

      it('can handle an empty list of reviews', async function() {
        const client = await createClient();
        client.cache.isEnabled = false;

        override(reviews, 'findPartialReviewsForBook', function() {
          return Promise.resolve([]);
        });

        assert.isEmpty(await client.getBookReviews('1', { limit: 1 }));
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
        return simulateResponse(URLS.apiBase, { status: 404 }, async function() {
          await assert.isRejected(
            createClient().getReadBooks('---'),
            /Invalid Goodreads user ID: ---/
          );
        });
      });

      it('forwards non-404 network errors', function() {
        return simulateResponse(URLS.apiBase, { status: 500 }, async function() {
          await assert.isRejected(
            createClient().getReadBooks('---'),
            /internal server error/i
          );
        });
      });

    });

  });

});
