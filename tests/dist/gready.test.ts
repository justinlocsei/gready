import path from 'path';
import tmp from 'tmp';
import { omit } from 'lodash';
import { spawnSync } from 'child_process';

import assert from '../helpers/assert';
import { getRequiredEnvironmentVariableNames } from '../../src/config';
import { paths } from '../../src/environment';

describe('gready', function() {

  this.slow(4500);
  this.timeout(5000);

  const VALID_ENV = {
    GREADY_GOODREADS_API_KEY: 'key',
    GREADY_GOODREADS_USER_ID: '1'
  };

  function runGready(args: string[] = [], env: Record<string, string> = {}) {
    return spawnSync(
      'node',
      [
        path.join(paths.distDir, 'bin', 'gready.js'),
        ...args,
        '--data-dir',
        tmp.dirSync().name,
        '--no-cache-data',
        '--no-cache-responses'
      ],
      {
        encoding: 'utf-8',
        env: {
          ...omit(process.env, getRequiredEnvironmentVariableNames()),
          ...env
        }
      }
    );
  }

  it('requires a subcommand', function() {
    const { status, stderr } = runGready();

    assert.equal(status, 1);
    assert.include(stderr, 'Usage');
  });

  it('can display usage on request', function() {
    const { status, stderr, stdout } = runGready(['--help']);

    assert.equal(status, 0);
    assert.isEmpty(stderr);
    assert.include(stdout, 'gready');
  });

  it('can display the version', function() {
    const { status, stderr, stdout } = runGready(['--version']);

    assert.equal(status, 0);
    assert.isEmpty(stderr);
    assert.match(stdout.trim(), /\d\.\d/);
  });

  it('validates options', function() {
    const { status, stderr } = runGready(['test', '--invalid-option']);

    assert.equal(status, 1);
    assert.include(stderr, 'invalid-option');
  });

  it('ensures that required environment variables are set', function() {
    const invalid = runGready(['test']);

    assert.equal(invalid.status, 1);
    assert.include(invalid.stderr, 'GREADY_GOODREADS_API_KEY');

    const partial = runGready(['test'], {
      GREADY_GOODREADS_API_KEY: 'key'
    });

    assert.equal(partial.status, 1);
    assert.include(partial.stderr, 'GREADY_GOODREADS_USER_ID');

    const valid = runGready(['test'], VALID_ENV);

    assert.equal(valid.status, 0);
    assert.isEmpty(valid.stderr);
  });

  it('can clear the cache', function() {
    const { status } = runGready(['clear-cache'], VALID_ENV);

    assert.equal(status, 0);
  });

  it('can show cache statistics', function() {
    const { status, stdout } = runGready(['show-cache-stats'], VALID_ENV);

    assert.equal(status, 0);
    assert.include(stdout, 'data');
    assert.include(stdout, 'response');
  });

  [
    'find-books',
    'find-readers',
    'sync-books',
    'summarize'
  ].forEach(function(command) {
    it(`requires a valid Goodreads API key to run the ${command} command`, function() {
      const { status, stderr } = runGready([command], VALID_ENV);

      assert.equal(status, 1);
      assert.include(stderr, 'API');
      assert.include(stderr, 'Unauthorized');
    });
  });

});
