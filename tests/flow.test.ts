import { range } from 'lodash';

import assert from './helpers/assert';
import { createTestLogger } from './helpers';
import { runSequence } from '../src/flow';

describe('flow', function() {

  describe('runSequence', function() {

    it('runs a sequence of tasks', async function() {
      const [logger] = createTestLogger();

      const results = await runSequence(
        ['testing'],
        [1, 2],
        logger,
        v => Promise.resolve(v * 2)
      );

      assert.deepEqual(results, [2, 4]);
    });

    it('logs the output of the sequence', async function() {
      const [logger, readLog] = createTestLogger();

      await runSequence(
        ['alfa'],
        range(0, 10),
        logger,
        v => Promise.resolve(v)
      );

      assert.deepEqual(await readLog(), [
        '[INFO] ===== alfa',
        '[INFO]  1/10 alfa',
        '[INFO]  2/10 alfa',
        '[INFO]  3/10 alfa',
        '[INFO]  4/10 alfa',
        '[INFO]  5/10 alfa',
        '[INFO]  6/10 alfa',
        '[INFO]  7/10 alfa',
        '[INFO]  8/10 alfa',
        '[INFO]  9/10 alfa',
        '[INFO] 10/10 alfa'
      ]);
    });

    it('supports a custom logging method', async function() {
      const [logger, readLog] = createTestLogger({ logLevel: 'debug' });

      await runSequence(
        ['alfa'],
        [1],
        logger,
        v => Promise.resolve(v),
        'debug'
      );

      assert.deepEqual(await readLog(), [
        '[DEBUG] === alfa',
        '[DEBUG] 1/1 alfa'
      ]);
    });

  });

});
