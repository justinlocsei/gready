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
  topReviews: Review[];
  totalRatings: number;
  workID: WorkID;
}

export interface Shelf {
  count: number;
  name: string;
}

export interface Review {
  bookID: BookID;
  id: ReviewID;
  posted: number;
  rating: number;
  shelves: string[];
  userID: UserID;
}
