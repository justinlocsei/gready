import { sortBy, uniq } from 'lodash';

import { Book, ReadBook } from '../types/core';
import { BookID } from '../types/goodreads';
import { Configuration } from '../types/config';
import { createBookshelf } from '../bookshelf';
import { getViewBookURL } from '../goodreads';
import { partition, underline } from '../content';
import { Partitioned } from '../types/util';
import { Repository } from '../repository';
import { runSequence } from '../flow';

export type PartitionedRecommendation = Partitioned<RecommendedBook>;

interface RecommendedBook {
  book: Book;
  recommendations: number;
}

/**
 * Find recommended books from a set of read books
 */
export async function findRecommendedBooks({
  config,
  coreBookIDs,
  limit,
  minRating,
  percentile,
  readBooks,
  repo,
  shelves
}: {
  config: Configuration;
  coreBookIDs?: BookID[];
  limit?: number;
  minRating: number;
  percentile: number;
  readBooks: ReadBook[];
  repo: Repository;
  shelves?: string[];
}): Promise<PartitionedRecommendation[]> {
  let bookIDs = readBooks
    .filter(r => r.rating && r.rating >= minRating)
    .map(r => r.bookID);

  if (coreBookIDs) {
    bookIDs = bookIDs.filter(id => coreBookIDs.includes(id));
  }

  let books = await runSequence(
    ['Find similar books'],
    uniq(bookIDs).sort(),
    repo.logger,
    id => repo.getBook(id)
  );

  if (shelves) {
    books = createBookshelf(books, config).getBooksInShelves(...shelves);
  }

  const ignoredAuthors = new Set(config.ignoreAuthors);
  const readIDs = new Set(readBooks.map(r => r.workID));

  const countsByID = books.reduce(function(previous: Record<BookID, number>, book) {
    book.similarBooks.forEach(function({ author, id, workID }) {
      if (!ignoredAuthors.has(author.name) && !readIDs.has(workID)) {
        previous[id] = previous[id] || 0;
        previous[id]++;
      }
    });

    return previous;
  }, {});

  const recommendations = Object.keys(countsByID).map(function(id) {
    return {
      bookID: id,
      recommendations: countsByID[id]
    };
  });

  const ranked = partition(recommendations, r => r.recommendations);

  const queries = sortBy(ranked.filter(r => r.percentile >= percentile), [
    r => r.percentile * -1,
    r => r.data.bookID
  ]);

  let queryIDs = uniq(queries.map(r => r.data.bookID));

  if (limit !== undefined) {
    queryIDs = queryIDs.slice(0, limit);
  }

  const percentiles = ranked.reduce(function(previous: Record<BookID, number>, { data: book, percentile }) {
    previous[book.bookID] = percentile;
    return previous;
  }, {});

  const recommendedBooks = await runSequence(
    ['Expand recommendations'],
    queryIDs,
    repo.logger,
    async function(bookID): Promise<RecommendedBook> {
      const book = await repo.getBook(bookID);

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
      `Shelves: ${shelves.join(', ')}`
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
