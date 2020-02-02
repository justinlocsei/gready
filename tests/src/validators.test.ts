import fs from 'fs-extra';
import path from 'path';

import assert from '../helpers/assert';
import { generateValidator } from '../../src/validators';
import { paths } from '../../src/environment';

describe('validators', function() {

  this.slow(4000);
  this.timeout(5000);

  describe('generateValidator', function() {

    const testTypesFile = path.join(paths.typesDir, '__testing.ts');
    const testValidatorDir = path.join(paths.validatorsDir, '__testing');

    afterEach(async function() {
      await fs.remove(testTypesFile);
      await fs.remove(testValidatorDir);
    });

    async function testValidator(...lines: string[]) {
      await fs.writeFile(testTypesFile, lines.join('\n'));
      return generateValidator(testTypesFile, testValidatorDir);
    }

    it('generates validation code for all exported types in a file', async function() {
      const { schema, validator } = await testValidator(
        'export type Exported = string;',
        'export type Alias = Internal;',
        'type Internal = string;'
      );

      assert.equal(
        path.dirname(schema.path),
        path.dirname(validator.path)
      );

      assert.deepEqual(
        Object.keys(JSON.parse(schema.content).definitions),
        ['Alias', 'Exported']
      );

      assert.match(validator.content, /validateExported/);
      assert.match(validator.content, /validateAlias/);
      assert.notMatch(validator.content, /validateInternal/);
    });

    it('throws an error when a file cannot be parsed', async function() {
      await assert.isRejected(
        testValidator('type Invalid ='),
        /Could not parse types/
      );

      await assert.isRejected(
        testValidator('type Invalid ='),
        /Type expected/
      );
    });

    it('defines functions to validate data against a schema', async function() {
      const { schema, validator } = await testValidator(
        'export interface Testing {',
        '  key: string;',
        '}'
      );

      await fs.mkdirp(testValidatorDir);
      await fs.writeFile(schema.path, schema.content);
      await fs.writeFile(validator.path, validator.content);

      const validation = require(validator.path);

      assert.property(validation, 'validateTesting');
      assert.isFunction(validation.validateTesting);

      assert.throws(() => validation.validateTesting({ key: 1 }), /string/);
      assert.doesNotThrow(() => validation.validateTesting({ key: 'one' }));
    });

  });

});
