import path from 'path';

import * as scripts from '../../src/scripts';
import assert from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';
import { paths } from '../../src/environment';
import { run } from '../../src/bin/clear-test-fixtures';

describe('bin/clear-test-fixtures', function() {

  const { expectAssertions, override } = allowOverrides(this);

  it('clears test directories', async function() {
    const plan = expectAssertions(1);

    override(scripts, 'removePaths', async function(title, removePaths) {
      plan.assert(function() {
        assert.isNotEmpty(removePaths);

        removePaths.forEach(function(removePath) {
          assert.match(
            path.relative(paths.testsDir, removePath),
            /^[a-z]/,
            `${removePath} was not under the tests directory`
          );
        });
      });
    });

    await run();

    plan.verify();
  });

});
