import assert from './assert';

import {
  extractPercentile,
  formalizeAuthorName,
  normalizeString,
  underline
} from '../src/content';

describe('content/extractPercentile', function() {

  function checkExtraction(
    input: number[],
    percentile: number,
    output: number[]
  ): void {
    const extracted = extractPercentile(
      input.map(v => ({data: v})),
      percentile,
      v => v.data
    );

    assert.deepEqual(
      extracted,
      output.map(v => ({data: v}))
    );
  }

  it('handles empty lists', function() {
    checkExtraction([], 100, []);
    checkExtraction([], 0, []);
  });

  it('handles lists with one item', function() {
    checkExtraction([1], 100, []);
    checkExtraction([1], 0, [1]);
  });

  it('handles lists with multiple items', function() {
    const cases: ([number[], number, number[]])[] = [
      [[1, 2], 100, []],
      [[1, 2], 50, [2]],
      [[1, 2], 0, [1, 2]],
      [[1, 2, 3], 100, []],
      [[1, 2, 3], 75, [3]],
      [[1, 2, 3], 50, [2, 3]],
      [[1, 2, 3], 0, [1, 2, 3]]
    ];

    cases.forEach(function([input, percentile, output]) {
      checkExtraction(input, percentile, output);
    });
  });

});

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
