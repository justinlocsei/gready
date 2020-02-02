import path from 'path';
import tmp from 'tmp';
import { mkdirSync, pathExistsSync } from 'fs-extra';

import assert from '../helpers/assert';
import { createOutputHandler } from '../helpers';
import { OperationalError } from '../../src/errors';
import { removePaths, runAsScript } from '../../src/scripts';

describe('scripts', function() {

  describe('removePaths', function() {

    function getRemovalOutput(title: string, paths: string[]): Promise<[string[], string[]]> {
      const [writeToStderr, readStderr] = createOutputHandler();
      const [writeToStdout, readStdout] = createOutputHandler();

      return removePaths(title, paths, {
        writeToStderr,
        writeToStdout
      }).then(() => [readStdout(), readStderr()]);
    }

    it('removes a series of paths', async function() {
      const rootDir = tmp.dirSync().name;

      const dirs = [
        path.join(rootDir, 'alfa'),
        path.join(rootDir, 'bravo')
      ];

      dirs.forEach(function(dir) {
        mkdirSync(dir);
        assert.isTrue(pathExistsSync(dir));
      });

      const [stdout, stderr] = await getRemovalOutput('Paths', dirs);

      assert.deepEqual(stdout, ['Paths', ...dirs.map(d => `  ${d}`)]);
      assert.isEmpty(stderr);

      dirs.forEach(function(dir) {
        assert.isFalse(pathExistsSync(dir));
      });
    });

    it('ignores invalid paths', async function() {
      const rootDir = tmp.dirSync().name;
      const missing = path.join(rootDir, 'missing');

      assert.isFalse(pathExistsSync(missing));

      const [stdout, stderr] = await getRemovalOutput('Errors', [missing]);

      assert.deepEqual(stdout, ['Errors', `  ${missing}`]);
      assert.isEmpty(stderr);

      assert.isFalse(pathExistsSync(missing));
    });

  });

  describe('runAsScript', function() {

    function getScriptOutput(code: () => Promise<void>): Promise<string[]> {
      const [writeToStderr, readStderr] = createOutputHandler();

      return runAsScript(code, { writeToStderr }).then(readStderr);
    }

    it('runs a block of code', async function() {
      const output = await getScriptOutput(() => Promise.resolve());
      assert.isEmpty(output);
    });

    it('logs the message of an operational error', async function() {
      const output = await getScriptOutput(async function() {
        throw new OperationalError('testing');
      });

      assert.deepEqual(output, ['testing']);
    });

    it('logs a full non-operational error', async function() {
      const output = await getScriptOutput(async function() {
        throw new Error('testing');
      });

      assert.deepEqual(output, ['Error: testing']);
    });

  });

});
