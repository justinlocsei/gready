import * as gready from '../../../src/gready';
import * as system from '../../../src/system';
import assert, { expectAssertions } from '../../helpers/assert';
import { allowOverrides } from '../../helpers/mocking';
import { run } from '../../../src/bin/gready';

describe('bin/gready', function() {

  const override = allowOverrides(this);

  it('runs the gready CLI with normalized arguments', async function() {
    const plan = expectAssertions(1);

    override(system, 'getArgs', () => ['alfa', 'bravo']);

    override(gready, 'runCLI', async function({ args }) {
      plan.checkpoint(function() {
        assert.deepEqual(args, ['alfa', 'bravo']);
      });

      return true;
    });

    await run();

    plan.verify();
  });

});
