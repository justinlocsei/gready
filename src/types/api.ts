import Ajv from 'ajv';

import { AuthorID, BookID, UserID, WorkID } from './goodreads';
import { ExtractArrayType, OneOrMore } from './core';
import { defineSchema, ExtractSchemaType, T } from '../validation';

export type ResponseBody = Record<string, any>;

/**
 * Extract the body from an API response
 */
export function extractResponseBody(response: unknown): ResponseBody {
  return ResponseSchema.conform(response).GoodreadsResponse;
}

export const BookInfoSchema = defineSchema<{
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
}>('book info', T.object({
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

export type BookInfo = ExtractSchemaType<typeof BookInfoSchema>['book'];

export const BookReviewsSchema = defineSchema<{
  reviews: {
    $: {
      end: string;
      start: string;
      total: string;
    };
    review: {
      book: {
        id: {
          _: BookID;
        };
      };
      rating: string;
    }[];
  };
}>('book reviews', T.object({
  reviews: T.object({
    $: T.object({
      end: T.string(),
      start: T.string(),
      total: T.string()
    }),
    review: T.array(T.object({
      book: T.object({
        id: T.object({
          _: T.string()
        })
      }),
      rating: T.string()
    }))
  })
}));

export type BookReview = ExtractArrayType<BookReviews['reviews']['review']>;
export type BookReviews = ExtractSchemaType<typeof BookReviewsSchema>;

const ResponseSchema = defineSchema<{
  GoodreadsResponse: ResponseBody;
}>('response', T.object({
  GoodreadsResponse: T.object()
}));

export const UserResponseSchema = defineSchema<{
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
