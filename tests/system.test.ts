import assert from './helpers/assert';
import { allowOverrides } from './helpers/mocking';

import {
  createMetaLogger,
  createOutputLogger,
  getEnvironmentVariable,
  markProcessAsFailed
} from '../src/system';

describe('system', function() {

  const { mock, stub } = allowOverrides(this);

  describe('createMetaLogger', function() {

    it('creates a function that writes to stderr', function() {
      const stdout = mock(process.stderr);
      stdout.expects('write').once().withArgs('testing\n');

      createMetaLogger()('testing');

      stdout.verify();
    });

  });

  describe('createOutputLogger', function() {

    it('creates a function that writes to stdout', function() {
      const stdout = mock(process.stdout);
      stdout.expects('write').once().withArgs('testing\n');

      createOutputLogger()('testing');

      stdout.verify();
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
