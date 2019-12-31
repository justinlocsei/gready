export interface Book {
  id: BookID;
}

export type BookID = string;

export interface BookReview {
  bookID: BookID;
  rating: number;
}

export type UserID = string;
