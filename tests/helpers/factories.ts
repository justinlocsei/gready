import * as Core from '../../src/types/core';
import Bookshelf from '../../src/bookshelf';

/**
 * Create a valid book
 */
export function createBook(data?: Partial<Core.Book>): Core.Book {
  return {
    author: { id: '1', name: 'Author Name' },
    averageRating: 1,
    canonicalID: '1',
    id: '1',
    publisher: 'Publisher',
    reviewsID: '1',
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
  books: Partial<Core.Book>[] = [],
  shelfPercentile = 0
): Bookshelf {
  return new Bookshelf(
    books.map(createBook),
    { shelfPercentile }
  );
}
