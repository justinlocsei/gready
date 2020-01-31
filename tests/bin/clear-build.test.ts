import path from 'path';
import { readFileSync } from 'graceful-fs';

import * as scripts from '../../src/scripts';
import assert from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';
import { paths } from '../../src/environment';
import { run } from '../../src/bin/clear-build';

describe('bin/clear-build', function() {

  const { expectAssertions, stub } = allowOverrides(this);

  it('clears transient build paths', async function() {
    const ignoredPaths = readFileSync(paths.gitignore, 'utf8')
      .split('\n')
      .filter(l => l.startsWith('/'))
      .map(l => path.join(paths.rootDir, l));

    const plan = expectAssertions(1);

    stub(scripts, 'removePaths', async function(title, removePaths) {
      plan.assert(function() {
        assert.isNotEmpty(removePaths);

        removePaths.forEach(function(removePath) {
          assert.include(ignoredPaths, removePath + '/');
        });
      });
    });

    await run();

    plan.verify();
  });

});
