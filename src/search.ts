import { flatten, sortBy, uniq } from 'lodash';

import Bookshelf from './bookshelf';
import Repository from './repository';
import { Book, ReadBook, Shelf, User } from './types/core';
import { BookID, UserID } from './types/goodreads';
import { getUserBooksURL } from './goodreads';
import { SimilarReader } from './types/search';

/**
 * Find readers who have left similar reviews of books
 */
export async function findReaders({
  maxReviews,
  readBooks,
  repo,
  shelfPercentile
}: {
  maxReviews: number;
  readBooks: ReadBook[];
  repo: Repository;
  shelfPercentile: number;
}): Promise<SimilarReader[]> {
  const booksByID: Record<BookID, Book> = {};
  const usersByID: Record<UserID, User> = {};
  const reviewers: Record<UserID, BookID[]> = {};

  const checkBooks = readBooks.filter(r => r.rating);

  for (const readBook of checkBooks) {
    const similar = await repo.getSimilarReviews(readBook, maxReviews);

    similar.forEach(function({ user }) {
      const userID = user.id;

      reviewers[userID] = reviewers[userID] || [];
      reviewers[userID].push(readBook.bookID);

      usersByID[userID] = usersByID[userID] || user;
    });
  }

  const sortedUserIDs = sortBy(
    Object.keys(reviewers),
    [
      id => reviewers[id].length * -1,
      id => id
    ]
  );

  const bookIDs = uniq(flatten(Object.values(reviewers))).sort();

  for (const bookID of bookIDs) {
    booksByID[bookID] = await repo.getBook(bookID);
  }

  const shelfNames = new Bookshelf(Object.values(booksByID), { shelfPercentile })
    .getShelves()
    .map(s => s.shelf.name)
    .sort();

  return sortedUserIDs.map(function(id): SimilarReader {
    const books = sortBy(
      reviewers[id].map(bid => booksByID[bid]),
      [
        b => b.title,
        b => b.id
      ]
    );

    const userBooks = new Bookshelf(books, { shelfPercentile });

    const shelves = shelfNames.reduce(function(previous: Shelf[], shelfName) {
      const shelved = userBooks.getBooksInShelves(shelfName);

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
        booksURL: getUserBooksURL(id)
      }
    };
  });
}
