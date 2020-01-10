import { sortBy } from 'lodash';

import { Author, Book, Shelf } from './types/data';
import { AuthorID } from './types/goodreads';
import { CORE_SHELVES } from './config';
import { formalizeAuthorName } from './content';

interface BooksByAuthor {
  author: Author;
  books: Book[];
}

interface BooksByShelf {
  books: {
    affinity: number;
    book: Book;
  }[];
  popularity: number;
  shelfName: string;
  totalCount: number;
}

/**
 * Group a set of a books by author
 */
export function groupBooksByAuthor(books: Book[]): BooksByAuthor[] {
  const authorsByID: Record<AuthorID, Author> = {};
  const booksByAuthor: Record<AuthorID, Book[]> = {};

  books.forEach(function(book) {
    const author = book.authors[0];

    authorsByID[author.id] = author;

    booksByAuthor[author.id] = booksByAuthor[author.id] || [];
    booksByAuthor[author.id].push(book);
  });

  const sortedAuthorIDs = sortBy(Object.keys(authorsByID), [
    id => formalizeAuthorName(authorsByID[id].name),
    id => id
  ]);

  return sortedAuthorIDs.map(function(id): BooksByAuthor {
    return {
      author: authorsByID[id],
      books: sortBy(booksByAuthor[id], [b => b.title, b => b.id])
    };
  });
}

/**
 * Group a set of books by shelf
 */
export function groupBooksByShelf(books: Book[], {
  minPercent = 1
}: {
  minPercent?: number;
}): BooksByShelf[] {
  const byShelf = books.reduce(function(previous: Record<string, BooksByShelf>, book) {
    const shelves = book.shelves.filter(s => !CORE_SHELVES.includes(s.name));

    annotateShelves(shelves).forEach(function({ affinity, shelf }) {
      if (affinity < minPercent) { return; }

      if (!previous[shelf.name]) {
        previous[shelf.name] = {
          books: [],
          popularity: 0,
          shelfName: shelf.name,
          totalCount: 0
        };
      }

      previous[shelf.name].totalCount += shelf.count;
      previous[shelf.name].books.push({ affinity, book });
    });

    return previous;
  }, {});

  const sortedShelves = sortBy(Object.keys(byShelf), [
    name => byShelf[name].totalCount * -1,
    name => name
  ]);

  const maxCount = byShelf[sortedShelves[0]].totalCount || 1;

  const shelves = sortedShelves.map(function(name) {
    const group = byShelf[name];

    return {
      ...group,
      books: sortBy(group.books, [
        b => b.affinity * -1,
        b => b.book.title,
        b => b.book.id
      ]),
      popularity: Math.round((byShelf[name].totalCount / maxCount) * 100)
    };
  });

  return shelves.filter(s => s.popularity >= minPercent);
}

/**
 * Annotate shelves with information about their context
 */
function annotateShelves(shelves: Shelf[]): {
  affinity: number;
  shelf: Shelf;
}[] {
  const maxCount = Math.max(...shelves.map(s => s.count), 1);

  return shelves.map(function(shelf) {
    return {
      affinity: Math.round((shelf.count / maxCount) * 100),
      shelf
    };
  });
}
