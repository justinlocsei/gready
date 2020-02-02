import assert from '../helpers/assert';
import { formatJSON } from '../../src/serialization';

describe('serialization', function() {

  describe('formatJSON', function() {

    it('deterministically formats objects', function() {
      assert.equal(
        formatJSON({ b: '2', a: 1, c: [true] }),
        [
          '{',
          '  "a": 1,',
          '  "b": "2",',
          '  "c": [',
          '    true',
          '  ]',
          '}'
        ].join('\n')
      );
    });

  });

});
