import cheerio from 'cheerio';
import querystring from 'querystring';
import { URL } from 'url';

import { BookID, ReviewID } from './types/goodreads';
import { makeGetRequest } from './network';
import { URLS } from './goodreads';

export interface PartialReview {
  id: ReviewID;
  rating: number;
}

/**
 * Extract the ID used to show a book's reviews from its widget's embed code
 */
export function extractReviewsIDFromWidget(embedCode: string): BookID | null {
  const $ = cheerio.load(embedCode);

  const $iframe = $('iframe[src]');
  if ($iframe.length !== 1) { return null; }

  const src = $iframe.attr('src');
  if (!src) { return null; }

  const url = new URL(src);

  return url.searchParams.get('isbn');
}

/**
 * Find partial reviews for a book
 */
export async function findPartialReviewsForBook(id: BookID, {
  limit = 10,
  rating
}: {
  limit?: number;
  rating?: number;
} = {}): Promise<PartialReview[]> {
  let allReviews: PartialReview[] = [];

  let done = false;
  let page = 1;

  while (!done) {
    const url = buildWidgetURL(id, limit, page, rating);
    const responseText = await makeGetRequest(url);

    const [exhausted, reviews] = extractReviews(responseText, rating);

    allReviews = allReviews.concat(reviews);
    page++;

    done = exhausted || allReviews.length >= limit;
  }

  return allReviews.slice(0, limit);
}

/**
 * Build a URL for requesting the reviews widget
 */
function buildWidgetURL(
  bookID: BookID,
  perPage: number,
  page: number,
  rating?: number
): string {
  const query: Record<string, string> = {
    did: 'DEVELOPER_ID',
    format: 'html',
    isbn: bookID,
    num_reviews: rating ? '50' : perPage.toString(),
    page: page.toString()
  };

  if (rating) {
    query.min_rating = rating.toString();
  }

  const url = new URL(URLS.reviewsWidget);
  url.search = querystring.stringify(query);

  return url.toString();
}

/**
 * Extract reviews from the markup of the reviews widget
 */
function extractReviews(markup: string, withRating?: number): [boolean, PartialReview[]] {
  const $ = cheerio.load(markup);
  const $reviews = $('[itemtype="http://schema.org/Review"]');

  const reviews: PartialReview[] = [];

  $reviews.each(function(i, review) {
    const $review = $(review);

    const href = $review.find('[itemprop="discussionUrl"]').attr('href');
    const stars = $review.find('[itemprop="reviewRating"]').text();

    const id = href && new URL(href).pathname.split('/').pop();
    const rating = stars.split(/★/).length - 1;

    if (id && (!withRating || withRating === rating)) {
      reviews.push({ id, rating });
    }
  });

  return [$reviews.length === 0, reviews];
}
