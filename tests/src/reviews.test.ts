import fs from 'fs-extra';
import path from 'path';

import assert from '../helpers/assert';
import { allowNetworkAccess, useNetworkFixture } from '../helpers/requests';
import { extractReviewsIDFromWidget, findPartialReviewsForBook } from '../../src/reviews';
import { paths } from '../../src/environment';

describe('reviews', function() {

  describe('extractReviewsIDFromWidget', function() {

    it('extracts the ID from valid embed code', function() {
      const widget = fs.readFileSync(path.join(paths.testFixturesDir, 'goodreads', 'reviews-widget.html'), 'utf8');

      assert.equal(
        extractReviewsIDFromWidget(widget),
        '0142437174'
      );
    });

    it('returns null if the embed code lacks an iframe', function() {
      assert.isNull(extractReviewsIDFromWidget(''));
    });

    it('returns null if the embed code lacks a src for its iframe', function() {
      assert.isNull(extractReviewsIDFromWidget('<iframe src=""></iframe>'));
    });

    it('returns null if the embed code lacks an ID in its iframe’s src', function() {
      assert.isNull(extractReviewsIDFromWidget('<iframe src="https://www.goodreads.com/api/reviews_widget_iframe?format=html"></iframe>'));
    });

  });

  describe('findPartialReviewsForBook', function() {

    allowNetworkAccess(this, {
      timeout: 10000,
      useFixtures: true
    });

    function withFixture(name: string, runTest: () => Promise<void>) {
      return useNetworkFixture(name, runTest, {
        removeHeaders: [
          'set-cookie',
          'x-amz-rid',
          'x-request-id',
          'x-runtime'
        ]
      });
    }

    it('returns an empty list for a book without reviews', async function() {
      await withFixture('reviews/empty', async function() {
        const reviews = await findPartialReviewsForBook('1');
        assert.deepEqual(reviews, []);
      });
    });

    it('returns the top reviews for a book by default', async function() {
      await withFixture('reviews/default', async function() {
        const reviews = await findPartialReviewsForBook('0439785960');

        assert.equal(reviews.length, 10);

        reviews.forEach(function({ id }) {
          assert.match(id, /^\d+$/);
        });
      });
    });

    it('can limit the number of returned reviews', async function() {
      await withFixture('reviews/limit', async function() {
        const reviews = await findPartialReviewsForBook('0439785960', { limit: 5 });

        assert.equal(reviews.length, 5);
      });
    });

    it('can filter the reviews by rating', async function() {
      await withFixture('reviews/rating', async function() {
        const four = await findPartialReviewsForBook('0439785960', { limit: 5, rating: 4 });
        const five = await findPartialReviewsForBook('0439785960', { limit: 5, rating: 5 });

        assert.equal(four.length, 5);
        assert.equal(five.length, 5);

        assert.equal(four.filter(r => r.rating === 4).length, 5);
        assert.equal(five.filter(r => r.rating === 5).length, 5);
      });
    });

  });

});
