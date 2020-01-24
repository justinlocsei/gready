import { intersection, sortBy, uniq } from 'lodash';

import Repository from '../repository';
import { Book, ReadBook } from '../types/core';
import { BookID } from '../types/goodreads';
import { getViewBookURL } from '../goodreads';
import { partition, underline } from '../content';
import { Partitioned } from '../types/util';
import { runSequence } from '../flow';

type PartitionedRecommendation = Partitioned<RecommendedBook>;

interface RecommendedBook {
  book: Book;
  recommendations: number;
}

/**
 * Find recommended books from a set of read books
 */
export async function findRecommendedBooks({
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
}): Promise<PartitionedRecommendation[]> {
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

  const output = recommendedBooks.map(function(rec): PartitionedRecommendation {
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
 * Produce a summary of recommended books
 */
export function summarizeRecommendedBooks(
  books: PartitionedRecommendation[],
  genrePercentile = 95
): string {
  const groups = books.map(function({ data: { book }, percentile }) {
    const shelves = partition(book.shelves, b => b.count)
      .filter(s => s.percentile >= genrePercentile)
      .map(s => s.data.name)
      .sort();

    let lines = [
      underline(`${book.title} | p${percentile}`),
      '',
      `Author: ${book.author.name}`,
      `Shelves: ${shelves.join(', ')}`,
    ];

    if (book.averageRating) {
      lines.push(`Average Rating: ${book.averageRating.toFixed(2)}`);
    }

    lines = [
      ...lines,
      '',
      `[View on Goodreads](${getViewBookURL(book.id)})`
    ];

    return lines.join('\n');
  });

  return groups.join('\n\n\n');
}
