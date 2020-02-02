type OneOrMore<T> = T | T[];

export interface Authorship {
  author: OneOrMore<{
    id: string;
    name: string;
  }>;
}

export interface Book {
  authors: Authorship;
  id: string;
  popular_shelves: {
    shelf: OneOrMore<{
      $: {
        count: string;
        name: string;
      };
    }>;
  };
  publisher: string;
  reviews_widget: string;
  similar_books?: {
    book: OneOrMore<{
      authors: Authorship;
      id: string;
    }>;
  };
  title: string;
  work: {
    best_book_id: { _: string; };
    id: { _: string; };
    original_title: string;
    ratings_count: { _: string; };
    ratings_sum: { _: string; };
  };
}

export interface BookResponse {
  book: Book;
}

export type ReadBook = Omit<Review, 'user'>;

export interface ReadBooksResponse {
  reviews: {
    $: {
      end: string;
      start: string;
      total: string;
    };
    review?: OneOrMore<ReadBook>;
  };
}

export interface Response {
  GoodreadsResponse: ResponseBody;
}

export type ResponseBody = { [key: string]: any; };

export interface Review {
  book: {
    id: {
      _: string;
    };
    publisher: string;
    work: {
      id: string;
    };
  };
  date_added: string;
  id: string;
  rating: string;
  read_at: string;
  shelves: {
    shelf: OneOrMore<{
      $: {
        name: string;
      };
    }>;
  };
  user: {
    id: string;
    link: string;
    name: string;
  };
}

export interface ReviewResponse {
  review: Review;
}
