import Ajv from 'ajv';

import { formatJSON } from '../serialization';

interface APITypeSchema<T> {
  conform: (data: unknown) => T;
  name: string;
}

type JSONSchema =
  | { anyOf: JSONSchema[]; }
  | { type: 'array'; items: JSONSchema; }
  | { type: 'number'; }
  | { type: 'object'; properties?: Record<string, JSONSchema>; required?: string[]; }
  | { type: 'string'; }

type ExtractArrayType<T> = T extends (infer U)[] ? U : T;
type ExtractSchemaType<T extends APITypeSchema<any>> = ReturnType<T['conform']>;
type OneOrMore<T> = T | T[];

export type ResponseBody = Record<string, any>;

/**
 * Define a schema for a type that can be used to validate API data
 */
function defineSchema<T>(name: string, schema: Record<string, JSONSchema>): APITypeSchema<T> {
  const jsonSchema: JSONSchema = {
    properties: schema,
    required: Object.keys(schema),
    type: 'object'
  };

  return {
    conform: data => conformToType<T>(name, jsonSchema, data),
    name
  };
}

/**
 * Ensure that data conforms to an API type
 *
 * @throws If the data does not conform to the type
 */
function conformToType<T>(typeName: string, schema: JSONSchema, data: unknown): T {
  const validator = new Ajv();
  const isValid = validator.validate(schema, data);

  if (isValid) {
    return data as T;
  }

  const errors = validator.errors;
  let error: string;

  if (errors && errors.length) {
    error = errors[0].message || formatJSON(errors[0].params);
    error = `${errors[0].dataPath} ${error}`;
  } else {
    error = 'unknown validation error';
  }

  throw new Error(`Invalid ${typeName}: ${error}\n${formatJSON(data)}`);
}

/**
 * Extract the body from an API response
 */
export function extractResponseBody(response: unknown): ResponseBody {
  return ResponseSchema.conform(response).GoodreadsResponse;
}

const T = {
  array: (items: JSONSchema): JSONSchema => ({
    items ,
    type: 'array'
  }),
  number: (): JSONSchema => ({
    type: 'number'
  }),
  object: <T extends Record<string, JSONSchema>>(props?: T, optional: (keyof T)[] = []): JSONSchema => ({
    properties: props,
    required: props && Object.keys(props).filter(k => optional.includes(k)),
    type: 'object'
  }),
  oneOrMore: (value: JSONSchema) => T.union([
    value,
    T.array(value)
  ]),
  string: (): JSONSchema => ({
    type: 'string'
  }),
  union: (members: JSONSchema[]): JSONSchema => ({
    anyOf: members
  })
};

export const BookInfoSchema = defineSchema<{
  book: {
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
    similar_books: {
      book: {
        id: string;
      }[];
    };
    work: {
      id: { _: string; };
      ratings_count: { _: string; };
      ratings_sum: { _: string; };
    };
  };
}>('book info', {
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
      ratings_count: T.object({ _: T.string() }),
      ratings_sum: T.object({ _: T.string() })
    })
  })
});

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
          _: string;
        };
      };
      rating: string;
    }[];
  };
}>('book reviews', {
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
});

export type BookReview = ExtractArrayType<BookReviews['reviews']['review']>;
export type BookReviews = ExtractSchemaType<typeof BookReviewsSchema>;

const ResponseSchema = defineSchema<{
  GoodreadsResponse: ResponseBody;
}>('response', {
  GoodreadsResponse: T.object()
});

export const UserResponseSchema = defineSchema<{
  user: {
    $: {
      id: string;
    };
  };
}>('user data', {
  user: T.object({
    $: T.object({
      id: T.string()
    })
  })
});
