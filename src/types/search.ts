import { Book, Shelf, User } from './data';

export interface SimilarReader {
  books: Book[];
  shelves: Shelf[];
  user: User;
}
