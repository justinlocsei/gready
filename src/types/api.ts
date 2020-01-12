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
    similar_books?: {
      book: {
        id: BookID;
      }[];
    };
    title: string;
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
    title: T.string(),
    work: T.object({
      id: T.object({ _: T.string() }),
      original_title: T.string(),
      ratings_count: T.object({ _: T.string() }),
      ratings_sum: T.object({ _: T.string() })
    })
  }, ['similar_books'])
}));

export type Book = ExtractSchemaType<typeof BookSchema>['book'];

const ReviewDataSchema = defineSchema<{
  book: {
    id: {
      _: BookID;
    };
    publisher: string;
  };
  date_added: string;
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
  };
}>('review data', T.object({
  book: T.object({
    id: T.object({
      _: T.string()
    }),
    publisher: T.string()
  }),
  date_added: T.string(),
  rating: T.string(),
  read_at: T.string(),
  shelves: T.object({
    shelf: T.oneOrMore(T.object({
      $: T.object({
        name: T.string()
      })
    }))
  }),
  user: T.object({
    id: T.string()
  })
}));

export type Review = ExtractSchemaType<typeof ReviewDataSchema>;

export const ReviewSchema = defineSchema<{
  review: Review;
}>('review', T.object({
  review: ReviewDataSchema.schema
}));

export const ReadBooksSchema = defineSchema<{
  reviews: {
    $: {
      end: string;
      start: string;
      total: string;
    };
    review: Review[];
  };
}>('read books', T.object({
  reviews: T.object({
    $: T.object({
      end: T.string(),
      start: T.string(),
      total: T.string()
    }),
    review: T.array(ReviewDataSchema.schema)
  })
}));

export type ReadBooks = ExtractSchemaType<typeof ReadBooksSchema>;

const ResponseSchema = defineSchema<{
  GoodreadsResponse: ResponseBody;
}>('response', T.object({
  GoodreadsResponse: T.object()
}));

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
