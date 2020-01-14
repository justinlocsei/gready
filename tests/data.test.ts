import assert from './assert';

import {
  ensureArray,
  isNumeric,
  maybeMap,
  normalizeString,
  underline
} from '../src/data';

describe('data/ensureArray', function() {

  it('converts a scalar to an array', function() {
    assert.deepEqual(ensureArray(1), [1]);
  });

  it('preserves an array', function() {
    assert.deepEqual(ensureArray([1]), [1]);
  });

});

describe('data/isNumeric', function() {

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

describe('data/maybeMap', function() {

  it('applies a mapping function an array', function() {
    assert.deepEqual(maybeMap([1, 2], v => v + 1), [2, 3]);
  });

  it('does nothing for an undefined value', function() {
    assert.isUndefined(maybeMap(undefined, v => v));
  });

});

describe('data/normalizeString', function() {

  it('removes excess space from a string', function() {
    assert.equal(
      normalizeString('  test  value  '),
      'test value'
    );
  });

});

describe('data/underline', function() {

  it('underlines a string', function() {
    assert.equal(
      underline('abcd'),
      'abcd\n===='
    );
  });

  it('can use a custom underline character', function() {
    assert.equal(
      underline('abcd', '-'),
      'abcd\n----'
    );
  });

});
