import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import assert from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';

import {
  captureConsoleOutput,
  createStderrWriter,
  createStdoutWriter,
  getArgs,
  getEnvironmentVariable,
  handleMissingFile,
  markProcessAsFailed
} from '../../src/system';

describe('system', function() {

  const { override } = allowOverrides(this);

  describe('captureConsoleOutput', function() {

    it('captures console messages', function() {
      const output = captureConsoleOutput(function() {
        console.log('alfa');
        console.log('bravo');
      }, ['log']);

      assert.deepEqual(output, [
        { args: ['alfa'], method: 'log' },
        { args: ['bravo'], method: 'log' }
      ]);
    });

    it('returns an empty list when no output occurs', function() {
      const output = captureConsoleOutput(
        function() {},
        ['log']
      );

      assert.isEmpty(output);
    });

  });

  describe('createStderrWriter', function() {

    it('creates a function that writes to stderr', function() {
      let output: unknown;

      override(process.stderr, 'write', function(message) {
        output = message;
        return true;
      });

      createStderrWriter()('testing');

      assert.equal(output, 'testing\n');
    });

  });

  describe('createStdoutWriter', function() {

    it('creates a function that writes to stdout', function() {
      let output: unknown;

      override(process.stdout, 'write', function(message) {
        output = message;
        return true;
      });

      createStdoutWriter()('testing');

      assert.equal(output, 'testing\n');
    });

  });

  describe('getArgs', function() {

    it('returns the arguments passed to the process', function() {
      override(process, 'argv', ['alfa', 'bravo']);
      assert.deepEqual(getArgs(), ['alfa', 'bravo']);
    });

  });

  describe('getEnvironmentVariable', function() {

    it('reads the value of an environment variable', function() {
      override(process, 'env', { 'VAR_NAME': '1' });
      assert.equal(getEnvironmentVariable('VAR_NAME'), '1');
    });

    it('returns undefined when a variable is absent', function() {
      override(process, 'env', {});
      assert.isUndefined(getEnvironmentVariable('VAR_NAME'), '1');
    });

  });

  describe('handleMissingFile', function() {

    it('returns the main branch when no missing-file error is thrown', async function() {
      const value = await handleMissingFile(
        async () => 'alfa',
        async () => 'bravo'
      );

      assert.equal(value, 'alfa');
    });

    it('returns the fallback branch if a file is missing', async function() {
      const dir = tmp.dirSync().name;

      const value = await handleMissingFile(
        () => fs.readFile(path.join(dir, 'missing'), 'utf8'),
        async () => 'bravo'
      );

      assert.equal(value, 'bravo');
    });

    it('throws an error if a non-missing file error is thrown', function() {
      const dir = tmp.dirSync().name;

      return assert.isRejected(
        handleMissingFile(
          () => fs.readFile(path.join(dir), 'utf8'),
          async () => 'bravo'
        ),
        'EISDIR'
      );
    });

    it('throws an error if a non-file error is thrown', function() {
      return assert.isRejected(
        handleMissingFile(
          async function() {
            throw new Error('testing');
            return 'alfa';
          },
          async () => 'bravo'
        ),
        'testing'
       );
    });

  });

  describe('markProcessAsFailed', function() {

    let previousCode: number | undefined;

    beforeEach(function() {
      previousCode = process.exitCode;
      process.exitCode = 0;
    });

    afterEach(function() {
      process.exitCode = previousCode;
    });

    it('sets a non-zero exit status for the current process', function() {
      override(process, 'exitCode', 0);
      assert.equal(process.exitCode, 0);

      markProcessAsFailed();
      assert.equal(process.exitCode, 1);
    });

  });

});
