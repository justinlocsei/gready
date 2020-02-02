import { sortBy } from 'lodash';

import { Book, ReadBook, Shelf, User } from '../types/core';
import { BookID, UserID } from '../types/goodreads';
import { Configuration } from '../types/config';
import { createBookshelf } from '../bookshelf';
import { getUserBooksURL } from '../goodreads';
import { Repository } from '../repository';
import { runSequence } from '../flow';
import { underline } from '../content';

export interface SimilarReader {
  books: Book[];
  shelves: Shelf[];
  user: User & {
    booksURL: string;
  };
}

/**
 * Find readers who have left similar reviews of books
 */
export async function findSimilarReaders({
  config,
  maxReviews,
  readBooks,
  repo
}: {
  config: Configuration;
  maxReviews: number;
  readBooks: ReadBook[];
  repo: Repository;
}): Promise<SimilarReader[]> {
  const booksByID: Record<BookID, Book> = {};
  const usersByID: Record<UserID, User> = {};
  const reviewers: Record<UserID, BookID[]> = {};

  const ratedBooks = readBooks.filter(r => r.rating);

  await runSequence(
    ['Load data on read books'],
    ratedBooks,
    repo.logger,
    async function({ bookID }) {
      booksByID[bookID] = await repo.getBook(bookID);
    }
  );

  await runSequence(
    ['Find similar readers'],
    ratedBooks,
    repo.logger,
    async function(readBook) {
      const similar = await repo.getSimilarReviews(
        booksByID[readBook.bookID],
        readBook,
        maxReviews
      );

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

  const shelfNames = createBookshelf(Object.values(booksByID), config)
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

    const userBooks = createBookshelf(books, config);

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

/**
 * Produce a summary of similar readers
 */
export function summarizeSimilarReaders(readers: SimilarReader[]): string {
  const groups = readers.map(function({ books, shelves, user }) {
    const lines = [
      underline(user.name),
      '',
      `[Profile](${user.profileURL})`,
      `[Books](${user.booksURL})`,
      '',
      underline(`Shared Books: ${books.length}`, '-'),
      ''
    ];

    books.forEach(function(book) {
      lines.push(`* ${book.title}`);
    });

    if (shelves.length) {
      lines.push('');
      lines.push(underline('Shared Shelves', '-'));
      lines.push('');

      shelves.forEach(function(shelf) {
        lines.push(`* ${shelf.name}: ${shelf.count}`);
      });
    }

    return lines.join('\n');
  });

  return groups.join('\n\n\n');
}
