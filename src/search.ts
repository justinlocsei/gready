import { flatten, sortBy, uniq } from 'lodash';

import Repository from './repository';
import { Book, ReadBook, Shelf, User } from './types/data';
import { BookID, UserID } from './types/goodreads';
import { getBooksInShelves, getPopularShelfNames } from './analysis';
import { SimilarReader } from './types/search';

/**
 * Find readers who have left similar reviews of books
 */
export async function findReaders({
  maxReviews,
  minShelfPercent,
  readBooks,
  repo
}: {
  maxReviews: number;
  minShelfPercent: number;
  readBooks: ReadBook[];
  repo: Repository;
}): Promise<SimilarReader[]> {
  const booksByID: Record<BookID, Book> = {};
  const usersByID: Record<UserID, User> = {};
  const reviewers: Record<UserID, BookID[]> = {};

  await Promise.all(readBooks.filter(r => r.rating).map(async function(readBook) {
    const similar = await repo.getSimilarReviews(readBook, maxReviews);

    similar.forEach(function({ user }) {
      const userID = user.id;

      reviewers[userID] = reviewers[userID] || [];
      reviewers[userID].push(readBook.bookID);

      usersByID[userID] = usersByID[userID] || user;
    });
  }));

  const sorted = sortBy(
    Object.keys(reviewers),
    [
      id => reviewers[id].length * -1,
      id => id
    ]
  );

  const bookIDs = uniq(flatten(Object.values(reviewers)));

  await Promise.all(bookIDs.map(async function(bookID) {
    booksByID[bookID] = await repo.getBook(bookID);
  }));

  const allBooks = Object.values(booksByID);
  const shelfNames = getPopularShelfNames(allBooks, minShelfPercent);

  return sorted.map(function(id) {
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
      user: usersByID[id]
    };
  });
}
