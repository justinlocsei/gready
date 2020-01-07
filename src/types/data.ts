import { AuthorID, BookID, WorkID } from './goodreads';

export interface Author {
  id: AuthorID;
  name: string;
}

export interface Book {
  authors: Author[];
  averageRating?: number;
  categories: Category[];
  id: BookID;
  publisher: string;
  similarBooks: BookID[];
  title: string;
  totalRatings: number;
  workID: WorkID;
}

export interface BookReview {
  bookID: BookID;
  rating: number;
}

export interface Category {
  count: number;
  name: string;
}
