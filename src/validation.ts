import Ajv from 'ajv';

import { formatJSON } from './serialization';

/**
 * Ensure that data conforms to a schema
 *
 * The provided schema must contain a `definitions` block that provides a
 * definition for the named type.
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
  validator.validate(schema, data);

  if (!validator.errors) {
    return data as T;
  } else {
    const { dataPath, message } = validator.errors[0];
    throw new Error(`Invalid ${typeName}: ${dataPath} ${message}\n${formatJSON(data)}`);
  }
}
