import assert from './assert';

import {
  formalizeAuthorName ,
  normalizeString,
  underline
} from '../src/content';

describe('content/formalizeAuthorName', function() {

  it('uses a last/first display for a name', function() {
    const cases = [
      ['Alfa', 'Alfa'],
      ['Alfa Bravo', 'Bravo, Alfa'],
      ['Alfa Bravo Charlie', 'Charlie, Alfa Bravo']
    ];

    cases.forEach(function([ input, expected ]) {
      assert.equal(formalizeAuthorName(input), expected);
    });
  });

});

describe('content/normalizeString', function() {

  it('removes excess space from a string', function() {
    assert.equal(
      normalizeString('  test  value  '),
      'test value'
    );
  });

});

describe('content/underline', function() {

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
