import { AuthorID, BookID, UserID, WorkID } from './goodreads';
import { defineSchema, ExtractSchemaType, T } from '../validation';
import { OneOrMore } from './core';

export type ResponseBody = Record<string, any>;

/**
 * Extract the body from an API response
 */
export function extractResponseBody(response: unknown): ResponseBody {
  return ResponseSchema.conform(response).GoodreadsResponse;
}

export const BookSchema = defineSchema<{
  book: {
    authors: {
      author: OneOrMore<{
        id: AuthorID;
        name: string;
      }>;
    };
    id: BookID;
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
    similar_books: {
      book: {
        id: BookID;
      }[];
    };
    work: {
      id: { _: WorkID; };
      original_title: string;
      ratings_count: { _: string; };
      ratings_sum: { _: string; };
    };
  };
}>('book', T.object({
  book: T.object({
    authors: T.object({
      author: T.oneOrMore(T.object({
        id: T.string(),
        name: T.string()
      }))
    }),
    id: T.string(),
    popular_shelves: T.object({
      shelf: T.array(T.object({
        $: T.object({
          count: T.string(),
          name: T.string()
        })
      }))
    }),
    publisher: T.string(),
    reviews_widget: T.string(),
    similar_books: T.object({
      book: T.array(T.object({
        id: T.string()
      }))
    }),
    work: T.object({
      id: T.object({ _: T.string() }),
      original_title: T.string(),
      ratings_count: T.object({ _: T.string() }),
      ratings_sum: T.object({ _: T.string() })
    })
  })
}));

export type Book = ExtractSchemaType<typeof BookSchema>['book'];

export const ReadBookSchema = defineSchema<{
  book: {
    id: {
      _: BookID;
    };
  };
  date_updated: string;
  rating: string;
}>('read book', T.object({
  book: T.object({
    id: T.object({
      _: T.string()
    })
  }),
  date_updated: T.string(),
  rating: T.string()
}));

export type ReadBook = ExtractSchemaType<typeof ReadBookSchema>;

export const ReadBooksSchema = defineSchema<{
  reviews: {
    $: {
      end: string;
      start: string;
      total: string;
    };
    review: ReadBook[];
  };
}>('read books', T.object({
  reviews: T.object({
    $: T.object({
      end: T.string(),
      start: T.string(),
      total: T.string()
    }),
    review: T.array(ReadBookSchema.schema)
  })
}));

export type ReadBooks = ExtractSchemaType<typeof ReadBooksSchema>;

const ResponseSchema = defineSchema<{
  GoodreadsResponse: ResponseBody;
}>('response', T.object({
  GoodreadsResponse: T.object()
}));

export const ReviewSchema = defineSchema<{
  review: {
    book: {
      id: {
        _: BookID;
      };
      publisher: string;
    };
    rating: string;
    user: {
      id: UserID;
    };
  };
}>('review', T.object({
  review: T.object({
    book: T.object({
      id: T.object({
        _: T.string()
      }),
      publisher: T.string()
    }),
    rating: T.string(),
    user: T.object({
      id: T.string()
    })
  })
}));

export type Review = ExtractSchemaType<typeof ReviewSchema>['review'];

export const UserDataSchema = defineSchema<{
  user: {
    $: {
      id: UserID;
    };
  };
}>('user data', T.object({
  user: T.object({
    $: T.object({
      id: T.string()
    })
  })
}));
