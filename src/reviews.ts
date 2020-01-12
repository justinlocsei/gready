import cheerio from 'cheerio';
import superagent from 'superagent';
import querystring from 'querystring';
import { URL } from 'url';

import { BookID, ReviewID } from './types/goodreads';
import { OperationalError } from './errors';

const WIDGET_URL = 'https://www.goodreads.com/api/reviews_widget_iframe';

/**
 * Find review IDs for a book
 */
export async function findReviewIDsForBook(id: BookID, {
  limit = 10,
  rating
}: {
  limit?: number;
  rating?: number;
} = {}): Promise<ReviewID[]> {
  let ids: ReviewID[] = [];

  let done = false;
  let page = 1;

  while (!done) {
    const url = buildWidgetURL(id, limit, page, rating);
    const response = await superagent.get(url);

    if (response.status !== 200) {
      throw new OperationalError(`Request for reviews widget at ${url} failed with code ${response.status}`);
    }

    const reviews = extractReviewIDs(response.text, rating);

    ids = ids.concat(reviews);
    page++;

    done = reviews.length < limit || ids.length >= limit;
  }

  return ids.slice(0, limit);
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
    num_reviews: perPage.toString(),
    page: page.toString()
  };

  if (rating) {
    query.min_rating = rating.toString();
  }

  const url = new URL(WIDGET_URL);
  url.search = querystring.stringify(query);

  return url.toString();
}

/**
 * Extract review IDs from the markup of the reviews widget
 */
function extractReviewIDs(markup: string, withRating?: number): ReviewID[] {
  const $ = cheerio.load(markup);
  const ids: ReviewID[] = [];

  $('[itemtype="http://schema.org/Review"]').each(function(i, review) {
    const $review = $(review);

    const href = $review.find('[itemprop="discussionUrl"]').attr('href');
    const stars = $review.find('[itemprop="reviewRating"]').text();

    const id = href && new URL(href).pathname.split('/').pop();
    const rating = (stars.match(/★/g) || []).length;

    if (id && (!withRating || withRating === rating)) {
      ids.push(id);
    }
  });

  return ids;
}
