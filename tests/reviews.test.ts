import assert from './helpers/assert';
import { findPartialReviewsForBook } from '../src/reviews';
import { useNetworkFixture } from './helpers/requests';

describe('reviews', function() {

  describe('findPartialReviewsForBook', function() {

    this.slow(9000);
    this.timeout(10000);

    it('returns an empty list for a book without reviews', async function() {
      await useNetworkFixture('reviews/empty', async function() {
        const reviews = await findPartialReviewsForBook('1');
        assert.deepEqual(reviews, []);
      });
    });

    it('returns the top reviews for a book by default', async function() {
      await useNetworkFixture('reviews/default', async function() {
        const reviews = await findPartialReviewsForBook('0439785960');

        assert.equal(reviews.length, 10);

        reviews.forEach(function({ id }) {
          assert.match(id, /^\d+$/);
        });
      });
    });

    it('can limit the number of returned reviews', async function() {
      await useNetworkFixture('reviews/limit', async function() {
        const reviews = await findPartialReviewsForBook('0439785960', { limit: 5 });

        assert.equal(reviews.length, 5);
      });
    });

    it('can filter the reviews by rating', async function() {
      await useNetworkFixture('reviews/rating', async function() {
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
