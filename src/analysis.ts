import { sortBy } from 'lodash';

import { Author, Book, Shelf } from './types/data';
import { AuthorID } from './types/goodreads';
import { formalizeAuthorName } from './content';

interface BooksByAuthor {
  author: Author;
  books: Book[];
}

interface BooksByPublisher {
  books: Book[];
  publisherName: string;
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
 * Group a set of books by publisher
 */
export function groupBooksByPublisher(books: Book[]): BooksByPublisher[] {
  const byPublisher = books.reduce(function(previous: Record<string, Book[]>, book) {
    const { publisher } = book;

    if (publisher) {
      previous[publisher] = previous[publisher] || [];
      previous[publisher].push(book);
    }

    return previous;
  }, {});

  const groups = Object.keys(byPublisher).map(function(publisher): BooksByPublisher {
    return {
      books: sortBy(byPublisher[publisher], [b => b.title, b => b.id]),
      publisherName: publisher
    };
  });

  return sortBy(groups, g => g.publisherName);
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
    annotateShelves(book.shelves).forEach(function({ affinity, shelf }) {
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

  const groups = Object.values(byShelf);
  const mostBooksInShelf = Math.max(...groups.map(g => g.books.length), 1);

  const shelves = Object.values(byShelf).map(function(group) {
    const totalBooks = group.books.length;
    const totalAffinity = group.books.reduce((p, b) => p + b.affinity, 0);

    const affinity = totalBooks / mostBooksInShelf;
    const averageAffinity = totalBooks && totalAffinity / totalBooks;

    return {
      ...group,
      books: sortBy(group.books, [
        b => b.affinity * -1,
        b => b.book.title,
        b => b.book.id
      ]),
      popularity: Math.round((affinity * averageAffinity / 100) * 100)
    };
  });

  return sortBy(
    shelves.filter(s => s.popularity >= minPercent),
    [
      s => s.popularity * -1,
      s => s.shelfName
    ]
  );
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
