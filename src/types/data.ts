import { AuthorID, BookID, UserID, WorkID } from './goodreads';

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
  topReviews: Review[];
  totalRatings: number;
  workID: WorkID;
}

export interface Category {
  count: number;
  name: string;
}

export interface ReadBook {
  id: BookID;
  rating: number;
}

export interface Review {
  bookID: BookID;
  rating: number;
  userID: UserID;
}
