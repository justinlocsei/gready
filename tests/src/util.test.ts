import assert from '../helpers/assert';

import {
  ensureArray,
  isNumeric,
  maybeMap
} from '../../src/util';

describe('util', function() {

  describe('ensureArray', function() {

    it('converts undefined to an empty array', function() {
      assert.deepEqual(ensureArray(undefined), []);
    });

    it('converts a scalar to an array', function() {
      assert.deepEqual(ensureArray(1), [1]);
    });

    it('preserves an array', function() {
      assert.deepEqual(ensureArray([1]), [1]);
    });

  });

  describe('isNumeric', function() {

    it('is true for a number', function() {
      assert.isTrue(isNumeric(1));
    });

    it('is false for NaN', function() {
      assert.isFalse(isNumeric(NaN));
    });

    it('is false for a non-numeric type', function() {
      assert.isFalse(isNumeric('a'));
    });

  });

  describe('maybeMap', function() {

    it('applies a mapping function an array', function() {
      assert.deepEqual(maybeMap([1, 2], v => v + 1), [2, 3]);
    });

    it('does nothing for an undefined value', function() {
      assert.isUndefined(maybeMap(undefined, v => v));
    });

  });

});
