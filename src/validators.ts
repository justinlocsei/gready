import Ajv from 'ajv';

import { formatJSON } from './serialization';

/**
 * Ensure that data conforms to a schema
 *
 * The provided schema must contain a `definitions` block that provides a
 * definition for the named type.
 *
 * @throws If the data does not conform to the schema
 */
export function validate<T>(
  jsonSchema: object,
  typeName: string,
  data: unknown
): T {
  const schema = {
    ...jsonSchema,
    '$ref': `#/definitions/${typeName}`
  };

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
