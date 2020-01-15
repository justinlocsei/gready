import {
  AuthorID,
  BookID,
  CanonicalBookID,
  ReviewID,
  UserID,
  WorkID
} from './goodreads';

export interface Author {
  id: AuthorID;
  name: string;
}

export interface Book {
  authors: Author[];
  averageRating?: number;
  canonicalID?: CanonicalBookID;
  id: BookID;
  publisher: string;
  shelves: Shelf[];
  similarBooks: BookID[];
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
  rating: number;
  shelves: string[];
  user: User;
}

export interface User {
  id: UserID;
  name: string;
  profileURL: string;
}

export interface UserMeta {
  id: UserID;
  shelves: string[];
}
