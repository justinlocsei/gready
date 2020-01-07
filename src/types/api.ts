import Ajv from 'ajv';

interface APIType<T> {
  conform: (data: unknown) => T;
  name: string;
}

type JSONSchema =
  | { type: 'array'; items: JSONSchema; }
  | { type: 'number'; }
  | { type: 'object'; properties?: Record<string, JSONSchema>; required?: string[]; }
  | { type: 'string'; }

/**
 * Define a type that can be used to validate API data
 */
function defineType<T>(name: string, schema: Record<string, JSONSchema>): APIType<T> {
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
    error = errors[0].message || JSON.stringify(errors[0].params, null, 2);
    error = `${errors[0].dataPath} ${error}`;
  } else {
    error = 'unknown validation error';
  }

  throw new Error(`Invalid ${typeName}: ${error}\n${JSON.stringify(data, null, 2)}`);
}

/**
 * Extract the body from an API response
 */
export function extractResponseBody(response: unknown): ResponseBody {
  return Response.conform(response).GoodreadsResponse;
}

export type ResponseBody = Record<string, any>;
export type ResponseType<T extends APIType<any>> = ReturnType<T['conform']>;

export const BookInfo = defineType<{
  book: {
    id: string;
  };
}>('book info', {
  book: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    }
  }
});

export const BookReviews = defineType<{
  reviews: {
    $: {
      end: string;
      start: string;
      total: string;
    };
    review: {
      book: {
        id: {
          _: 'string';
        };
      };
      rating: string;
    }[];
  };
}>('book reviews', {
  reviews: {
    type: 'object',
    properties: {
      $: {
        type: 'object',
        properties: {
          end: { type: 'string' },
          start: { type: 'string' },
          total: { type: 'string' }
        }
      },
      review: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            book: {
              type: 'object',
              properties: {
                id: {
                  type: 'object',
                  properties: {
                    _: { type: 'string' }
                  }
                }
              }
            },
            rating: { type: 'string' }
          }
        }
      }
    }
  }
});

const Response = defineType<{
  GoodreadsResponse: ResponseBody;
}>('response', {
  GoodreadsResponse: { type: 'object' }
});

export const UserResponse = defineType<{
  user: {
    $: {
      id: string;
    };
  };
}>('user data', {
  user: {
    type: 'object',
    properties: {
      $: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }
});
