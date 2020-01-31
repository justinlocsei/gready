import tmp from 'tmp';

import * as config from '../src/config';
import * as libCLI from '../src/cli';
import * as system from '../src/system';
import assert from './helpers/assert';
import { allowOverrides } from './helpers/mocking';
import { createOutputHandler, createTestConfig } from './helpers';
import { runCLI } from '../src/gready';

describe('gready', function() {

  const { expectAssertions, override } = allowOverrides(this);

  async function testCLI(
    args?: string[],
    prepare?: (cli: libCLI.CLI) => Promise<void>
  ): Promise<{
    dataDir: string;
    stderr: string;
    stderrLines: string[];
    stdout: string;
    stdoutLines: string[];
    succeeded: boolean;
  }> {
    const dataDir = tmp.dirSync().name;

    const [handleStderr, readStderr] = createOutputHandler();
    const [handleStdout, readStdout] = createOutputHandler();

    override(config, 'getGoodreadsAPIKey', () => 'apikey');
    override(config, 'getGoodreadsUserID', () => 'user');

    override(libCLI, 'createCLI', async function(options) {
      const cli = new libCLI.CLI(options);

      if (prepare) {
        await prepare(cli);
      }

      return cli;
    });

    const succeeded = await runCLI({
      args: [
        ...(args || []),
        '--data-dir',
        dataDir
      ],
      writeToStderr: handleStderr,
      writeToStdout: handleStdout
    });

    const stdoutLines = readStdout();
    const stderrLines = readStderr();

    return {
      dataDir,
      stderr: stderrLines.join('\n'),
      stderrLines,
      stdout: stdoutLines.join('\n'),
      stdoutLines,
      succeeded
    };
  }

  it('shows usage when no arguments are provided', async function() {
    const plan = expectAssertions(1);

    override(system, 'markProcessAsFailed', function() {
      plan.checkpoint();
    });

    const { stderr, stdout, succeeded } = await testCLI();

    assert.isFalse(succeeded);
    assert.isEmpty(stdout);

    assert.match(stderr, /You must specify a subcommand/);
    assert.match(stderr, /Usage/);
    assert.match(stderr, /gready test/);

    plan.verify();
  });

  it('can run a test command', async function() {
    const { stderr, stdout, succeeded } = await testCLI(['test']);

    assert.isTrue(succeeded);
    assert.isEmpty(stdout);
    assert.isEmpty(stderr);
  });

  it('supports a custom log level', async function() {
    const plan = expectAssertions(2);

    await testCLI(['test'], async function(cli) {
      plan.assert(function() {
        assert.equal(cli.logger.level, 'info');
      });
    });

    await testCLI(['test', '--log-level', 'debug'], async function(cli) {
      plan.assert(function() {
        assert.equal(cli.logger.level, 'debug');
      });
    });

    plan.verify();
  });

  it('validates the log level', async function() {
    const { stderr, stdout, succeeded } = await testCLI(['test', '--log-level', 'logtest']);

    assert.isFalse(succeeded);
    assert.isEmpty(stdout);

    assert.match(stderr, /Invalid values/);
    assert.match(stderr, /logtest/);
  });

  it('allows colorized logging to be toggled', async function() {
    const plan = expectAssertions(2);

    await testCLI(['test', '--color'], async function(cli) {
      plan.assert(function() {
        assert.isTrue(cli.logger.useColor);
      });
    });

    await testCLI(['test', '--no-color'], async function(cli) {
      plan.assert(function() {
        assert.isFalse(cli.logger.useColor);
      });
    });

    plan.verify();
  });

  it('allows logger timestamps to be toggled', async function() {
    const plan = expectAssertions(2);

    await testCLI(['test', '--log-time'], async function(cli) {
      plan.assert(function() {
        assert.isTrue(cli.logger.showTime);
      });
    });

    await testCLI(['test', '--no-log-time'], async function(cli) {
      plan.assert(function() {
        assert.isFalse(cli.logger.showTime);
      });
    });

    plan.verify();
  });

  it('accepts a path to a custom configuration', async function() {
    let configPath: unknown;

    override(config, 'loadConfig', function(path) {
      configPath = path;
      return Promise.resolve(createTestConfig());
    });

    await testCLI(['test', '--config', '/config.json']);

    assert.equal(configPath, '/config.json');
  });

  it('can disable the data cache', async function() {
    const plan = expectAssertions(2);

    await testCLI(['test', '--cache-data'], async function(cli) {
      plan.assert(function() {
        assert.isTrue(cli.repo.cache.isEnabled);
      });
    });

    await testCLI(['test', '--no-cache-data'], async function(cli) {
      plan.assert(function() {
        assert.isFalse(cli.repo.cache.isEnabled);
      });
    });

    plan.verify();
  });

  it('can disable the response cache', async function() {
    const plan = expectAssertions(2);

    await testCLI(['test', '--cache-responses'], async function(cli) {
      plan.assert(function() {
        assert.isTrue(cli.repo.apiClient.cache.isEnabled);
      });
    });

    await testCLI(['test', '--no-cache-responses'], async function(cli) {
      plan.assert(function() {
        assert.isFalse(cli.repo.apiClient.cache.isEnabled);
      });
    });

    plan.verify();
  });

  it('ensures that a shelf percentile is numeric', async function() {
    const withString = await testCLI(['test', '--shelf-percentile', 'ten']);
    const withNumber = await testCLI(['test', '--shelf-percentile', '10']);

    assert.isFalse(withString.succeeded);
    assert.isTrue(withNumber.succeeded);

    assert.isEmpty(withNumber.stderr);
    assert.match(withString.stderr, /--shelf-percentile option must be a number/);
  });

  describe('clear-cache', function() {

    type FakeClearCache = (ns: string[] | undefined) => void;

    function clearCache(args: string[] = [], {
      onClearDataCache,
      onClearResponseCache
    }: {
      onClearDataCache?: FakeClearCache;
      onClearResponseCache?: FakeClearCache;
    } = {}) {
      return testCLI(['clear-cache', ...args], async function({ repo }) {
        override(repo.cache, 'clear', async function(namespaces) {
          if (onClearDataCache) {
            onClearDataCache(namespaces);
          }
        });

        override(repo.apiClient.cache, 'clear', async function(namespaces) {
          if (onClearResponseCache) {
            onClearResponseCache(namespaces);
          }
        });
      });
    }

    it('clears all caches by default', async function() {
      const plan = expectAssertions(2);

      await clearCache([], {
        onClearDataCache: function(namespaces) {
          plan.assert(function() {
            assert.isUndefined(namespaces);
          });
        },
        onClearResponseCache: function(namespaces) {
          plan.assert(function() {
            assert.isUndefined(namespaces);
          });
        }
      });

      plan.verify();
    });

    it('can selectively clear a cache', async function() {
      const plan = expectAssertions(1);

      await clearCache(['--cache', 'data'], {
        onClearDataCache: function(namespaces) {
          plan.assert(function() {
            assert.isUndefined(namespaces);
          });
        },
        onClearResponseCache: function(namespaces) {
          plan.assert(function() {
            assert.fail('the response cache was incorrectly cleared');
          });
        }
      });

      plan.verify();
    });

    it('can selectively clear one or more cache namespaces', async function() {
      const plan = expectAssertions(1);

      await clearCache(
        [
          '--cache',
          'data',
          '--namespace',
          'alfa',
          '--namespace',
          'bravo'
        ], {
          onClearDataCache: function(namespaces) {
            plan.assert(function() {
              assert.deepEqual(namespaces, ['alfa', 'bravo']);
            });
          },
          onClearResponseCache: function(namespaces) {
            plan.assert(function() {
              assert.fail('the response cache was incorrectly cleared');
            });
          }
        }
      );

      plan.verify();
    });

    it('validates cache names', async function() {
      const { stderr, succeeded } = await clearCache(['--cache', 'invalidcache']);

      assert.isFalse(succeeded);
      assert.match(stderr, /invalidcache/);
    });

  });

  describe('find-books', function() {

    function findBooks(
      args: string[],
      checkOptions?: (...args: Parameters<libCLI.CLI['findBooks']>) => void
    ) {
      return testCLI(['find-books', ...args], async function(cli) {
        override(cli, 'findBooks', async function(options) {
          if (checkOptions) {
            checkOptions(options);
          }
        });
      });
    }

    it('finds similar readers', async function() {
      const plan = expectAssertions(1);

      await findBooks([], function({ coreBookIDs, minRating, percentile, shelfPercentile, shelves }) {
        plan.assert(function() {
          assert.isAbove(shelfPercentile, 0);
          assert.isAbove(minRating, 0);
          assert.isAbove(percentile, 0);

          assert.isUndefined(coreBookIDs);
          assert.isUndefined(shelves);
        });
      });

      plan.verify();
    });

    it('respects a custom shelf percentile', async function() {
      const plan = expectAssertions(2);

      await findBooks(['--shelf-percentile', '10'], function({ shelfPercentile }) {
        plan.assert(function() {
          assert.equal(shelfPercentile, 10);
        });
      });

      await findBooks(['--shelf-percentile', '20'], function({ shelfPercentile }) {
        plan.assert(function() {
          assert.equal(shelfPercentile, 20);
        });
      });

      plan.verify();
    });

    it('respects a minimum rating', async function() {
      const plan = expectAssertions(2);

      await findBooks(['--min-rating', '2'], function({ minRating }) {
        plan.assert(function() {
          assert.equal(minRating, 2);
        });
      });

      await findBooks(['--min-rating', '3'], function({ minRating }) {
        plan.assert(function() {
          assert.equal(minRating, 3);
        });
      });

      plan.verify();
    });

    it('respects a custom match percentile', async function() {
      const plan = expectAssertions(2);

      await findBooks(['--percentile', '10'], function({ percentile }) {
        plan.assert(function() {
          assert.equal(percentile, 10);
        });
      });

      await findBooks(['--percentile', '20'], function({ percentile }) {
        plan.assert(function() {
          assert.equal(percentile, 20);
        });
      });

      plan.verify();
    });

    it('respects a set of core book IDs', async function() {
      const plan = expectAssertions(1);

      await findBooks(['--book-id', '1', '--book-id', '2'], function({ coreBookIDs }) {
        plan.assert(function() {
          assert.deepEqual(coreBookIDs, ['1', '2']);
        });
      });

      plan.verify();
    });

    it('respects a set of shelves', async function() {
      const plan = expectAssertions(1);

      await findBooks(['--shelf', 'alfa', '--shelf', 'bravo'], function({ shelves }) {
        plan.assert(function() {
          assert.deepEqual(shelves, ['alfa', 'bravo']);
        });
      });

      plan.verify();
    });

    it('ensures that the minimum rating is numeric', async function() {
      const { stderr, succeeded } = await findBooks(['--min-rating', 'ten']);

      assert.isFalse(succeeded);
      assert.match(stderr, /--min-rating option must be a number/);
    });

    it('ensures that the percentile is numeric', async function() {
      const { stderr, succeeded } = await findBooks(['--percentile', 'ten']);

      assert.isFalse(succeeded);
      assert.match(stderr, /--percentile option must be a number/);
    });

  });

  describe('find-readers', function() {

    function findReaders(
      args: string[],
      checkOptions?: (...args: Parameters<libCLI.CLI['findReaders']>) => void
    ) {
      return testCLI(['find-readers', ...args], async function(cli) {
        override(cli, 'findReaders', async function(options) {
          if (checkOptions) {
            checkOptions(options);
          }
        });
      });
    }

    it('finds similar readers', async function() {
      const plan = expectAssertions(1);

      await findReaders([], function({ bookIDs, maxReviews, minBooks, shelfPercentile }) {
        plan.assert(function() {
          assert.isAbove(shelfPercentile, 0);
          assert.isAbove(maxReviews, 0);

          assert.isUndefined(bookIDs);
          assert.isUndefined(minBooks);
        });
      });

      plan.verify();
    });

    it('respects a custom shelf percentile', async function() {
      const plan = expectAssertions(2);

      await findReaders(['--shelf-percentile', '10'], function({ shelfPercentile }) {
        plan.assert(function() {
          assert.equal(shelfPercentile, 10);
        });
      });

      await findReaders(['--shelf-percentile', '20'], function({ shelfPercentile }) {
        plan.assert(function() {
          assert.equal(shelfPercentile, 20);
        });
      });

      plan.verify();
    });

    it('respects a limit on the number of reviews', async function() {
      const plan = expectAssertions(2);

      await findReaders(['--reviews', '2'], function({ maxReviews }) {
        plan.assert(function() {
          assert.equal(maxReviews, 2);
        });
      });

      await findReaders(['--reviews', '3'], function({ maxReviews }) {
        plan.assert(function() {
          assert.equal(maxReviews, 3);
        });
      });

      plan.verify();
    });

    it('respects a minimum number of shared books', async function() {
      const plan = expectAssertions(2);

      await findReaders(['--min-books', '2'], function({ minBooks }) {
        plan.assert(function() {
          assert.equal(minBooks, 2);
        });
      });

      await findReaders(['--min-books', '3'], function({ minBooks }) {
        plan.assert(function() {
          assert.equal(minBooks, 3);
        });
      });

      plan.verify();
    });

    it('respects a set of required book IDs', async function() {
      const plan = expectAssertions(1);

      await findReaders(['--book-id', '1', '--book-id', '2'], function({ bookIDs }) {
        plan.assert(function() {
          assert.deepEqual(bookIDs, ['1', '2']);
        });
      });

      plan.verify();
    });

    it('ensures that the review limit is numeric', async function() {
      const { stderr, succeeded } = await findReaders(['--reviews', 'ten']);

      assert.isFalse(succeeded);
      assert.match(stderr, /--reviews option must be a number/);
    });

    it('ensures that the shared-books value is numeric', async function() {
      const { stderr, succeeded } = await findReaders(['--min-books', 'ten']);

      assert.isFalse(succeeded);
      assert.match(stderr, /--min-books option must be a number/);
    });

  });

  describe('show-cache-stats', function() {

    it('shows information on the cache entries', async function() {
      const { stderr, stdoutLines } = await testCLI(['show-cache-stats'], async function({ repo }) {
        override(repo.cache, 'stats', async function() {
          return [
            { items: 1, namespace: 'alfa' },
            { items: 2, namespace: 'bravo' }
          ];
        });

        override(repo.apiClient.cache, 'stats', async function() {
          return [
            { items: 3, namespace: 'charlie' }
          ];
        });
      });

      assert.isEmpty(stderr);

      assert.deepEqual(stdoutLines, [
        'data',
        '  alfa: 1',
        '  bravo: 2',
        '',
        'response',
        '  charlie: 3'
      ]);
    });

  });

  describe('summarize', function() {

    function summarize(
      args: string[],
      checkOptions?: (...args: Parameters<libCLI.CLI['summarize']>) => void
    ) {
      return testCLI(['summarize', ...args], async function(cli) {
        override(cli, 'summarize', async function(options) {
          if (checkOptions) {
            checkOptions(options);
          }
        });
      });
    }

    it('summarizes a user’s books', async function() {
      const plan = expectAssertions(1);

      await summarize([], function({ sections, shelfPercentile, shelves }) {
        plan.assert(function() {
          assert.isAbove(shelfPercentile, 0);

          assert.isUndefined(sections);
          assert.isUndefined(shelves);
        });
      });

      plan.verify();
    });

    it('respects a custom shelf percentile', async function() {
      const plan = expectAssertions(2);

      await summarize(['--shelf-percentile', '10'], function({ shelfPercentile }) {
        plan.assert(function() {
          assert.equal(shelfPercentile, 10);
        });
      });

      await summarize(['--shelf-percentile', '20'], function({ shelfPercentile }) {
        plan.assert(function() {
          assert.equal(shelfPercentile, 20);
        });
      });

      plan.verify();
    });

    it('can filter the summary by section', async function() {
      const plan = expectAssertions(1);

      await summarize(['--section', 'publishers', '--section', 'shelves'], function({ sections }) {
        plan.assert(function() {
          assert.deepEqual(sections, ['publishers', 'shelves']);
        });
      });

      plan.verify();
    });

    it('validates section names', async function() {
      const { stderr, succeeded } = await summarize(['--section', 'invalidsection']);

      assert.isFalse(succeeded);
      assert.match(stderr, /invalidsection/);
    });

    it('can filter the summary by shelf', async function() {
      const plan = expectAssertions(1);

      await summarize(['--shelf', 'alfa', '--shelf', 'bravo'], function({ shelves }) {
        plan.assert(function() {
          assert.deepEqual(shelves, ['alfa', 'bravo']);
        });
      });

      plan.verify();
    });

  });

  describe('sync-books', function() {

    function syncBooks(
      args: string[],
      checkArgs?: (recent?: number) => void
    ) {
      return testCLI(['sync-books', ...args], async function(cli) {
        override(cli, 'syncBooks', async function(recent) {
          if (checkArgs) {
            checkArgs(recent);
          }
        });
      });
    }

    it('syncs a user’s books', async function() {
      const plan = expectAssertions(1);

      await syncBooks([], function(recent) {
        plan.assert(function() {
          assert.isUndefined(recent);
        });
      });

      plan.verify();
    });

    it('respects the recent number of books', async function() {
      const plan = expectAssertions(2);

      await syncBooks(['--recent', '2'], function(recent) {
        plan.assert(function() {
          assert.equal(recent, 2);
        });
      });

      await syncBooks(['--recent', '3'], function(recent) {
        plan.assert(function() {
          assert.equal(recent, 3);
        });
      });

      plan.verify();
    });

    it('ensures that the number of recent books is numeric', async function() {
      const { stderr, succeeded } = await syncBooks(['--recent', 'two']);

      assert.isFalse(succeeded);
      assert.match(stderr, /--recent option must be a number/);
    });

  });

});
