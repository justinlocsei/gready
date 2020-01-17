import { Book, Shelf, User } from './core';

export interface RecommendedBook {
  book: Book;
  recommendations: number;
}

export interface SimilarReader {
  books: Book[];
  shelves: Shelf[];
  user: User & {
    booksURL: string;
  };
}
