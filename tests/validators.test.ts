import assert from './assert';

import { validate } from '../src/validators';

describe('validators', function() {

  describe('validate', function() {

    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      definitions: {
        Testing: {
          properties: {
            testing: {
              type: 'string'
            }
          },
          type: 'object'
        }
      }
    };

    it('validates a type against a JSON schema', function() {
      assert.deepEqual(
        validate(schema, 'Testing', { testing: 'test' }),
        { testing: 'test' }
      );
    });

    it('throws an error if data does not conform to the schema', function() {
      assert.throws(
        () => validate(schema, 'Testing', { testing: 1 }),
        /testing.*string/
      );
    });

    it('throws an error if the named type is not defined in the schema', function() {
      assert.throws(
        () => validate(schema, 'Missing', { testing: 'test' }),
        'Missing'
      );
    });


  });

});
