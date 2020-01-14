import { SimilarReader } from './types/search';
import { underline } from './data';

/**
 * Produce a summary of similar readers
 */
export function summarizeSimilarReaders(readers: SimilarReader[]): string {
  const groups = readers.map(function({ books, shelves, user }) {
    const lines = [
      underline(`${user.name}`),
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
