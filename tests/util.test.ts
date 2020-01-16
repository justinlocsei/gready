import assert from './assert';

import {
  ensureArray,
  isNumeric,
  maybeMap
} from '../src/util';

describe('util/ensureArray', function() {

  it('converts a scalar to an array', function() {
    assert.deepEqual(ensureArray(1), [1]);
  });

  it('preserves an array', function() {
    assert.deepEqual(ensureArray([1]), [1]);
  });

});

describe('util/isNumeric', function() {

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

describe('util/maybeMap', function() {

  it('applies a mapping function an array', function() {
    assert.deepEqual(maybeMap([1, 2], v => v + 1), [2, 3]);
  });

  it('does nothing for an undefined value', function() {
    assert.isUndefined(maybeMap(undefined, v => v));
  });

});
