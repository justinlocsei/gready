import Ajv from 'ajv';

import { formatJSON } from './serialization';

export type JSONSchema =
  | { anyOf: JSONSchema[]; }
  | { type: 'array'; items: JSONSchema; }
  | { type: 'number'; }
  | { type: 'object'; additionalProperties?: JSONSchema; properties?: Record<string, JSONSchema>; required?: string[]; }
  | { type: 'string'; }

interface Schema<T> {
  conform: (data: unknown) => T;
  name: string;
  schema: JSONSchema;
}

export type ExtractSchemaType<T extends Schema<any>> = ReturnType<T['conform']>;

/**
 * Define a schema for a type that can be used to validate data
 */
export function defineSchema<T>(
  name: string,
  schema: JSONSchema
): Schema<T> {
  return {
    conform: data => conformToType<T>(name, schema, data),
    name,
    schema
  };
}

/**
 * Ensure that data conforms to a schema
 *
 * @throws If the data does not conform to the schema
 */
function conformToType<T>(
  typeName: string,
  schema: JSONSchema,
  data: unknown
): T {
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

export const T = {
  array: (items: JSONSchema): JSONSchema => ({
    items,
    type: 'array'
  }),
  number: (): JSONSchema => ({
    type: 'number'
  }),
  object: <T extends Record<string, JSONSchema>>(props?: T, optional: (keyof T)[] = [], additionalProperties?: JSONSchema): JSONSchema => ({
    additionalProperties,
    properties: props,
    required: props && Object.keys(props).filter(k => !optional.includes(k)),
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
