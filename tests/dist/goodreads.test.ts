import path from 'path';
import tmp from 'tmp';
import { spawnSync } from 'child_process';

import assert from '../helpers/assert';
import { getGoodreadsAPIKey, hasGoodreadsAPIKey } from '../../src/config';
import { paths } from '../../src/environment';

describe('Goodreads integration', function() {

  this.slow(18000);
  this.timeout(20000);

  let dataDir: string;

  before(function() {
    if (!hasGoodreadsAPIKey()) {
      this.skip();
    }
  });

  beforeEach(function() {
    dataDir = tmp.dirSync().name;
  });

  function testGoodreadsCommand(...args: string[]) {
    return spawnSync(
      'node',
      [
        path.join(paths.distDir, 'bin', 'gready.js'),
        ...args,
        '--data-dir',
        dataDir,
        '--recent-books',
        '1'
      ],
      {
        encoding: 'utf-8',
        env: {
          ...process.env,
          GREADY_GOODREADS_API_KEY: getGoodreadsAPIKey(),
          GREADY_GOODREADS_USER_ID: '4'
        }
      }
    );
  }

  specify('gready sync-books', function() {
    const { status, stderr } = testGoodreadsCommand('sync-books');

    assert.equal(status, 0);
    assert.include(stderr, 'Fetch read books');
    assert.include(stderr, 'Sync books');
  });

  specify('gready summarize', function() {
    const sync = testGoodreadsCommand('sync-books');
    const summarize = testGoodreadsCommand('summarize');

    assert.equal(sync.status, 0);
    assert.equal(summarize.status, 0);

    assert.include(summarize.stdout, 'All Shelves');
    assert.include(summarize.stdout, 'p100');
  });

  specify('gready find-books', function() {
    const { status, stdout } = testGoodreadsCommand('find-books', '--percentile', '100', '--limit', '1');

    assert.equal(status, 0);
    assert.include(stdout, 'p100');
    assert.include(stdout, 'Author:');
    assert.include(stdout, 'goodreads.com');
  });

  specify('gready find-readers', function() {
    const { status, stdout } = testGoodreadsCommand('find-readers', '--reviews', '1');

    assert.equal(status, 0);
    assert.include(stdout, 'Profile');
    assert.include(stdout, 'goodreads.com');
    assert.include(stdout, 'Shared Shelves');
  });

});
