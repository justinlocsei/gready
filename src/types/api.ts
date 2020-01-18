type OneOrMore<T> = T | T[];

export interface Book {
  authors: {
    author: OneOrMore<{
      id: string;
      name: string;
    }>;
  };
  id: string;
  popular_shelves: {
    shelf: {
      $: {
        count: string;
        name: string;
      };
    }[];
  };
  publisher: string;
  reviews_widget: string;
  similar_books?: {
    book: {
      id: string;
    }[];
  };
  title: string;
  work: {
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
    review: ReadBook[];
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

export interface SearchResults {
  search: {
    results: {
      work: OneOrMore<{
        best_book: {
          author: {
            id: {
              _: string;
            };
          };
          id: {
            _: string;
          };
        };
      }>;
    };
  };
}
