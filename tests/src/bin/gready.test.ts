import * as gready from '../../../src/gready';
import * as system from '../../../src/system';
import assert from '../../helpers/assert';
import { allowOverrides } from '../../helpers/mocking';
import { run } from '../../../src/bin/gready';

describe('bin/gready', function() {

  const { expectAssertions, override } = allowOverrides(this);

  it('runs the gready CLI with normalized arguments', async function() {
    const plan = expectAssertions(1);

    override(system, 'getArgs', () => ['alfa', 'bravo']);

    override(gready, 'runCLI', async function({ args }) {
      plan.assert(function() {
        assert.deepEqual(args, ['alfa', 'bravo']);
      });

      return true;
    });

    await run();

    plan.verify();
  });

});
