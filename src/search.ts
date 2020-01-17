import { flatten, intersection, sortBy, uniq } from 'lodash';

import Bookshelf from './bookshelf';
import Repository from './repository';
import { Book, ReadBook, Shelf, User } from './types/core';
import { BookID, UserID } from './types/goodreads';
import { getUserBooksURL } from './goodreads';
import { partition } from './content';
import { Partitioned } from './types/util';
import { runSequence } from './flow';
import { RecommendedBook, SimilarReader } from './types/search';

/**
 * Find recommended books from a set of read books
 */
export async function findBooks({
  coreBookIDs,
  minRating,
  percentile,
  readBooks,
  repo,
  shelfPercentile,
  shelves
}: {
  coreBookIDs?: BookID[];
  minRating: number;
  percentile: number;
  readBooks: ReadBook[];
  repo: Repository;
  shelfPercentile: number;
  shelves?: string[];
}): Promise<Partitioned<RecommendedBook>[]> {
  let bookIDs = readBooks
    .filter(r => r.rating >= minRating)
    .map(r => r.bookID);

  if (coreBookIDs) {
    bookIDs = bookIDs.filter(id => coreBookIDs.includes(id));
  }

  const booksByID: Record<BookID, Book> = {};
  const countsByID: Record<BookID, number> = {};

  await runSequence(
    ['Find recommended books'],
    bookIDs.sort(),
    repo.logger,
    async function(bookID) {
      let book: Book;

      if (!booksByID[bookID]) {
        book = await repo.getBook(bookID);
        booksByID[bookID] = book;
      } else {
        book = booksByID[bookID];
      }

      if (shelves) {
        const shelfNames = partition(book.shelves, s => s.count)
          .filter(s => s.percentile >= shelfPercentile)
          .map(s => s.data.name);

        if (!intersection(shelves, shelfNames).length) {
          return;
        }
      }

      book.similarBooks.forEach(function(bookID) {
        countsByID[bookID] = countsByID[bookID] || 0;
        countsByID[bookID]++;
      });
    }
  );

  const readIDs = new Set(readBooks.map(r => r.bookID));

  const recommendations = Object
    .keys(countsByID)
    .map(function(id) {
      return {
        bookID: id,
        recommendations: countsByID[id]
      };
    })
    .filter(r => !readIDs.has(r.bookID));

  const ranked = partition(recommendations, r => r.recommendations);
  const queries = ranked.filter(r => r.percentile >= percentile);
  const queryIDs = uniq(queries.map(r => r.data.bookID));

  const percentiles = ranked.reduce(function(previous: Record<BookID, number>, { data: book, percentile }) {
    previous[book.bookID] = percentile;
    return previous;
  }, {});

  const recommendedBooks = await runSequence(
    ['Expand recommendations'],
    queryIDs.sort(),
    repo.logger,
    async function(bookID): Promise<RecommendedBook> {
      let book: Book;

      if (!booksByID[bookID]) {
        book = await repo.getBook(bookID);
        booksByID[bookID] = book;
      } else {
        book = booksByID[bookID];
      }

      return {
        book,
        recommendations: countsByID[bookID]
      };
    }
  );

  const output = recommendedBooks.map(function(rec): Partitioned<RecommendedBook> {
    return {
      data: rec,
      percentile: percentiles[rec.book.id]
    };
  });

  return sortBy(output, [
    r => r.percentile * -1,
    r => r.data.book.title,
    r => r.data.book.id
  ]);
}

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

  await runSequence(
    ['Find similar readers'],
    readBooks.filter(r => r.rating),
    repo.logger,
    async function(readBook) {
      const similar = await repo.getSimilarReviews(readBook, maxReviews);

      similar.forEach(function({ user }) {
        const userID = user.id;

        reviewers[userID] = reviewers[userID] || [];
        reviewers[userID].push(readBook.bookID);

        usersByID[userID] = usersByID[userID] || user;
      });
    }
  );

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
    .map(s => s.data.name)
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
