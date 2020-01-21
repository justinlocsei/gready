import Bookshelf from '../src/bookshelf';
import { Book } from '../src/types/core';

/**
 * Create a valid book
 */
export function createBook(data?: Partial<Book>): Book {
  return {
    author: { id: '1', name: 'Author Name' },
    averageRating: 1,
    canonicalID: '1',
    id: '1',
    publisher: 'Publisher',
    shelves: [],
    similarBooks: [],
    title: 'Title',
    totalRatings: 0,
    workID: '1',
    ...data
  };
}

/**
 * Create a bookshelf with books
 */
export function createBookshelf(
  books: Partial<Book>[] = [],
  shelfPercentile = 0
): Bookshelf {
  return new Bookshelf(
    books.map(createBook),
    { shelfPercentile }
  );
}
