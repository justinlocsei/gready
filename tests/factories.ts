import { Book } from '../src/types/core';

/**
 * Create a valid book
 */
export function createBook(data?: Partial<Book>): Book {
  return {
    authors: [],
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
