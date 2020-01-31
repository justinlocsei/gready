import fs from 'fs-extra';
import glob from 'glob';
import path from 'path';
import tmp from 'tmp';

import * as system from '../../src/system';
import assert from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';
import { createOutputHandler } from '../helpers';
import { paths } from '../../src/environment';
import { run } from '../../src/bin/generate-validators';

describe('bin/generate-validators', function() {

  this.slow(9000);
  this.timeout(10000);

  const { override } = allowOverrides(this);

  let backupDir: string | undefined;

  function moveChildren(fromDir: string, toDir: string) {
    glob.sync(path.join(fromDir, '*')).forEach(function(childPath) {
      fs.moveSync(childPath, path.join(toDir, path.basename(childPath)));
    });
  }

  beforeEach(function() {
    if (fs.existsSync(paths.validatorsDir)) {
      backupDir = tmp.dirSync().name;
      moveChildren(paths.validatorsDir, backupDir);
    }
  });

  afterEach(function() {
    if (backupDir) {
      fs.removeSync(paths.validatorsDir);
      moveChildren(backupDir, paths.validatorsDir);
    }
  });

  it('writes generated validator files to disk', async function() {
    const [handleStdout, readStdout] = createOutputHandler();
    const [handleStderr, readStderr] = createOutputHandler();

    override(system, 'createStderrWriter', () => handleStderr);
    override(system, 'createStdoutWriter', () => handleStdout);

    await fs.remove(paths.validatorsDir);
    assert.isFalse(fs.existsSync(paths.validatorsDir));

    await run();
    assert.isTrue(fs.existsSync(paths.validatorsDir));

    assert.isEmpty(readStderr());
    assert.isNotEmpty(readStdout());

    assert.isNotEmpty(fs.readdirSync(paths.validatorsDir));
  });

});
