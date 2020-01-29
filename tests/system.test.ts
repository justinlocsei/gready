import assert from './helpers/assert';
import { allowOverrides } from './helpers/mocking';

import {
  createStderrWriter,
  createStdoutWriter,
  getArgs,
  getEnvironmentVariable,
  markProcessAsFailed
} from '../src/system';

describe('system', function() {

  const { stub } = allowOverrides(this);

  describe('createStderrWriter', function() {

    it('creates a function that writes to stderr', function() {
      let output: unknown;

      stub(process.stderr, 'write', function(message) {
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

      stub(process.stdout, 'write', function(message) {
        output = message;
        return true;
      });

      createStdoutWriter()('testing');

      assert.equal(output, 'testing\n');
    });

  });

  describe('getArgs', function() {

    it('returns the arguments passed to the process', function() {
      stub(process, 'argv', ['alfa', 'bravo']);
      assert.deepEqual(getArgs(), ['alfa', 'bravo']);
    });

  });

  describe('getEnvironmentVariable', function() {

    it('reads the value of an environment variable', function() {
      stub(process, 'env', { 'VAR_NAME': '1' });
      assert.equal(getEnvironmentVariable('VAR_NAME'), '1');
    });

    it('returns undefined when a variable is absent', function() {
      stub(process, 'env', {});
      assert.isUndefined(getEnvironmentVariable('VAR_NAME'), '1');
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
      stub(process, 'exitCode', 0);
      assert.equal(process.exitCode, 0);

      markProcessAsFailed();
      assert.equal(process.exitCode, 1);
    });

  });

});
