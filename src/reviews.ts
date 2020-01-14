import cheerio from 'cheerio';
import superagent from 'superagent';
import querystring from 'querystring';
import { URL } from 'url';

import { BookID, CanonicalBookID, ReviewID } from './types/goodreads';
import { OperationalError } from './errors';
import { URLS } from './goodreads';

/**
 * Extract a book's canonical ID from the markup for its reviews widget
 */
export function extractCanonicalIDFromReviewsWidget(embedCode: string): CanonicalBookID | null {
  const $ = cheerio.load(embedCode);
  const src = $('iframe').attr('src');

  if (!src) {
    throw new OperationalError(`No iframe found in embed code for reviews widget\n${embedCode}`);
  }

  return new URL(src).searchParams.get('isbn');
}

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

  const url = new URL(URLS.reviewsWidget);
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
