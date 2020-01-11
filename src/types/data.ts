import { AuthorID, BookID, UserID, WorkID } from './goodreads';

export interface Author {
  id: AuthorID;
  name: string;
}

export interface Book {
  authors: Author[];
  averageRating?: number;
  id: BookID;
  publisher: string;
  shelves: Shelf[];
  similarBooks: BookID[];
  title: string;
  topReviews: Review[];
  totalRatings: number;
  workID: WorkID;
}

export interface Shelf {
  count: number;
  name: string;
}

export interface ReadBook {
  id: BookID;
  rating: number;
  readOn: number;
  shelves: string[];
}

export interface Review {
  rating: number;
  userID: UserID;
}
