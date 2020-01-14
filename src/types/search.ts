import { Book, Shelf, User } from './core';

export interface SimilarReader {
  books: Book[];
  shelves: Shelf[];
  user: User & {
    booksURL: string;
  };
}
