import querystring from 'querystring';
import { flatten, sortBy, uniq } from 'lodash';
import { URL } from 'url';

import Logger from './logger';
import Repository from './repository';
import { Book, ReadBook, Shelf, User } from './types/data';
import { BookID, UserID } from './types/goodreads';
import { getBooksInShelves, getPopularShelfNames } from './analysis';
import { SimilarReader } from './types/search';

const BOOKS_URL = 'https://www.goodreads.com/review/list';

/**
 * Find readers who have left similar reviews of books
 */
export async function findReaders({
  logger,
  maxReviews,
  readBooks,
  repo,
  shelfPercentile
}: {
  logger: Logger;
  maxReviews: number;
  readBooks: ReadBook[];
  repo: Repository;
  shelfPercentile: number;
}): Promise<SimilarReader[]> {
  const booksByID: Record<BookID, Book> = {};
  const usersByID: Record<UserID, User> = {};
  const reviewers: Record<UserID, BookID[]> = {};

  const checkBooks = readBooks.filter(r => r.rating);
  const totalBooks = checkBooks.length;
  let index = 0;

  for (const readBook of checkBooks) {
    index++;
    logger.info('Find similar reviews', `Current=${index}`, `Total=${totalBooks}`, `BookID=${readBook.bookID}`);

    const similar = await repo.getSimilarReviews(readBook, maxReviews);

    similar.forEach(function({ user }) {
      const userID = user.id;

      reviewers[userID] = reviewers[userID] || [];
      reviewers[userID].push(readBook.bookID);

      usersByID[userID] = usersByID[userID] || user;
    });
  }

  const sorted = sortBy(
    Object.keys(reviewers),
    [
      id => reviewers[id].length * -1,
      id => id
    ]
  );

  const bookIDs = uniq(flatten(Object.values(reviewers)));

  for (const bookID of bookIDs) {
    logger.info('Fetch book', `ID=${bookID}`);
    booksByID[bookID] = await repo.getBook(bookID);
  }

  const allBooks = Object.values(booksByID);
  const shelfNames = getPopularShelfNames(allBooks, minShelfPercent);

  const userShelves: Record<UserID, string[]> = {};

  for (const user of Object.values(usersByID)) {
    logger.info('Get user shelves', `ID=${user.id}`);
    userShelves[user.id] = await repo.getUserShelves(user.id);
  }

  return sorted.map(function(id): SimilarReader {
    const books = sortBy(
      reviewers[id].map(bid => booksByID[bid]),
      [
        b => b.title,
        b => b.id
      ]
    );

    const shelves = shelfNames.reduce(function(previous: Shelf[], shelfName) {
      const shelved = getBooksInShelves(books, [shelfName], minShelfPercent);

      if (shelved.length) {
        previous.push({
          count: shelved.length,
          name: shelfName
        });
      }

      return previous;
    }, []);

    return {
      books,
      shelves: sortBy(shelves, [s => s.count * -1, s => s.name]),
      user: {
        ...usersByID[id],
        booksURL: getUserBooksURL(id, userShelves[id])
      }
    };
  });
}

/**
 * Get the URL for viewing a user's books
 */
function getUserBooksURL(id: UserID, shelves: string[]): string {
  const url = new URL(`${BOOKS_URL}/${id}`);

  url.search = querystring.stringify({
    order: 'd',
    sort: 'avg_rating',
    shelf: shelves.find(s => s === 'favorites') || 'read'
  });

  return url.toString();
}
