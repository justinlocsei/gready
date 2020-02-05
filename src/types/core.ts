import {
  AuthorID,
  BookID,
  ReviewID,
  UserID,
  WorkID
} from './goodreads';

export interface Author {
  id: AuthorID;
  name: string;
}

export interface Book {
  author: Author;
  averageRating?: number;
  canonicalID: BookID;
  id: BookID;
  publisher: string;
  reviewsID: BookID;
  shelves: Shelf[];
  similarBooks: SimilarBook[];
  title: string;
  totalRatings: number;
  workID: WorkID;
}

export interface Shelf {
  count: number;
  name: string;
}

export type ReadBook = Omit<Review, 'user'>;

export interface Review {
  bookID: BookID;
  id: ReviewID;
  posted: number;
  rating?: number;
  shelves: string[];
  user: User;
  workID: WorkID;
}

export interface SimilarBook {
  author: Author;
  id: BookID;
  workID: WorkID;
}

export interface User {
  id: UserID;
  name: string;
  profileURL: string;
}
