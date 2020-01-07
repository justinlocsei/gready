export interface Author {
  id: AuthorID;
  name: string;
}

type AuthorID = string;

export interface Book {
  authors: Author[];
  averageRating?: number;
  categories: Category[];
  id: BookID;
  publisher: string;
  similarBooks: BookID[];
  totalRatings: number;
  workID: WorkID;
}

export type BookID = string;

export interface BookReview {
  bookID: BookID;
  rating: number;
}

export interface Category {
  count: number;
  name: string;
}

export type UserID = string;

type WorkID = string;
