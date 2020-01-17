import assert from './assert';

import {
  formalizeAuthorName,
  normalizeString,
  partition,
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

describe('content/partition', function() {

  function checkPartition(
    values: number[],
    percentiles: number[]
  ): void {
    const partitioned = partition(values, v => v);

    assert.deepEqual(
      partitioned,
      percentiles.map((p, i) => ({ data: values[i], percentile: p }))
    );
  }

  it('handles empty lists', function() {
    checkPartition([], []);
  });

  it('handles lists with one item', function() {
    checkPartition([1], [100]);
  });

  it('handles lists with multiple items', function() {
    const cases: ([number[], number[]])[] = [
      [[1, 2], [50, 100]],
      [[1, 2, 3], [33, 67, 100]],
      [[1, 2, 3, 4], [25, 50, 75, 100]]
    ];

    cases.forEach(function([values, percentiles]) {
      checkPartition(values, percentiles);
    });
  });

  it('handles lists with duplicate values', function() {
    checkPartition([1, 1, 2], [50, 50, 100]);
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
