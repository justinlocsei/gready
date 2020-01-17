import { getViewBookURL } from './goodreads';
import { partition, underline } from './content';
import { Partitioned } from './types/util';
import { RecommendedBook, SimilarReader } from './types/search';

/**
 * Produce a summary of recommended books
 */
export function summarizeRecommendedBooks(
  books: Partitioned<RecommendedBook>[],
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
      `Author: ${book.authors[0].name}`,
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

    return lines.join('\n')
  });

  return groups.join('\n\n\n');
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

  return groups.join('\n\n\n')
}
