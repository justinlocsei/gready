import fs from 'fs-extra';
import tmp from 'tmp';
import { promisify } from 'util';

import * as system from '../src/system';
import assert from './helpers/assert';
import { allowOverrides } from './helpers/mocking';
import { OperationalError } from '../src/errors';
import { UserConfiguration } from '../src/types/config';

import {
  buildConfig,
  getGoodreadsAPIKey,
  getGoodreadsUserID,
  hasGoodreadsAPIKey,
  loadConfig
} from '../src/config';

const tmpFileAsync = promisify(tmp.file);

describe('config', function() {

  const { override } = allowOverrides(this);

  describe('buildConfig', function() {

    it('produces a valid configuration by default', function() {
      assert.deepEqual(buildConfig(), {
        ignoreAuthors: [],
        ignoreShelves: [],
        mergePublishers: {},
        mergeShelves: {},
        shelfPercentile: 0
      });
    });

    it('merges in user-provided configuration data', function() {
      const config: UserConfiguration = {
        ignoreAuthors: ['Author'],
        ignoreShelves: ['shelf'],
        mergePublishers: { alfa: ['bravo'] },
        mergeShelves: { charlie: ['delta'] },
        shelfPercentile: 1
      };

      assert.deepEqual(buildConfig(config), config);
    });

  });

  describe('getGoodreadsAPIKey', function() {

    it('returns the key when the environment variable is set', function() {
      override(system, 'getEnvironmentVariable', function(varName) {
        return varName === 'GREADY_GOODREADS_API_KEY' ? 'key' : undefined;
      });

      assert.equal(getGoodreadsAPIKey(), 'key');
    });

    it('throws an error when the environment variable is unset', function() {
      override(system, 'getEnvironmentVariable', v => undefined);

      assert.throws(
        () => getGoodreadsAPIKey(),
        OperationalError,
        /Goodreads API key/
      );
    });

  });

  describe('getGoodreadsUserID', function() {

    it('returns the user ID when the environment variable is set', function() {
      override(system, 'getEnvironmentVariable', function(varName) {
        return varName === 'GREADY_GOODREADS_USER_ID' ? 'id' : undefined;
      });

      assert.equal(getGoodreadsUserID(), 'id');
    });

    it('throws an error when the environment variable is unset', function() {
      override(system, 'getEnvironmentVariable', v => undefined);

      assert.throws(
        () => getGoodreadsUserID(),
        OperationalError,
        /Goodreads user ID/
      );
    });

  });

  describe('hasGoodreadsAPIKey', function() {

    it('returns true when the environment variable is set', function() {
      override(system, 'getEnvironmentVariable', function(varName) {
        return varName === 'GREADY_GOODREADS_API_KEY' ? 'key' : undefined;
      });

      assert.isTrue(hasGoodreadsAPIKey());
    });

    it('returns false when the environment variable is unset', function() {
      override(system, 'getEnvironmentVariable', v => undefined);

      assert.isFalse(hasGoodreadsAPIKey());
    });

  });

  describe('loadConfig', function() {

    async function createConfig(config: UserConfiguration | string): Promise<string> {
      const configPath = await tmpFileAsync();

      await fs.writeFile(
        configPath,
        typeof config === 'string' ? config : JSON.stringify(config)
      );

      return configPath;
    }

    it('can load a config file from a path', async function() {
      const configPath = await createConfig({
        ignoreAuthors: ['Author'],
        ignoreShelves: ['shelf'],
        mergePublishers: { 'alfa': ['bravo'] },
        mergeShelves: { 'charlie': ['delta'] },
        shelfPercentile: 1
      });

      const config = await loadConfig(configPath);

      assert.deepEqual(config.ignoreAuthors, ['Author']);
      assert.deepEqual(config.ignoreShelves, ['shelf']);
      assert.deepEqual(config.mergePublishers, { 'alfa': ['bravo'] });
      assert.deepEqual(config.mergeShelves, { 'charlie': ['delta'] });
      assert.equal(config.shelfPercentile, 1);
    });

    it('allows the config file to be missing', async function() {
      const config = await loadConfig('/missing.json', { allowMissing: true });

      assert.deepEqual(config.ignoreAuthors, []);
      assert.deepEqual(config.ignoreShelves, []);
      assert.deepEqual(config.mergePublishers, {});
      assert.deepEqual(config.mergeShelves, {});
      assert.equal(config.shelfPercentile, 0);
    });

    it('supports partial configs', async function() {
      const configPath = await createConfig({
        ignoreShelves: ['shelf']
      });

      const config = await loadConfig(configPath);

      assert.deepEqual(config.ignoreAuthors, []);
      assert.deepEqual(config.ignoreShelves, ['shelf']);
      assert.deepEqual(config.mergePublishers, {});
      assert.deepEqual(config.mergeShelves, {});
      assert.equal(config.shelfPercentile, 0);
    });

    it('throws an error when a config file is missing', function() {
      return assert.isRejected(
        loadConfig('/invalid/config.json'),
        /no config file found.*config\.json/i
      );
    });

    it('throws an error when a config file is improperly formatted', async function() {
      const configPath = await createConfig('{');

      return assert.isRejected(
        loadConfig(configPath),
        /invalid JSON/i
      );
    });

    it('throws an error when a config file contains invalid data', async function() {
      const configPath = await createConfig('{"ignoreShelves": [1]}');

      return assert.isRejected(
        loadConfig(configPath),
        /invalid configuration/i
      );
    });

  });

});
