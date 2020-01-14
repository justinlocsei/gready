import assert from './assert';

import { formalizeAuthorName } from '../src/content';

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
