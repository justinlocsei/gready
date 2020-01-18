import fs from 'graceful-fs';
import sinon from 'sinon';
import tmp from 'tmp';
import { promisify } from 'util';

import assert from './assert';
import { OperationalError } from '../src/errors';
import { UserConfiguration } from '../src/types/config';

import {
  getDefaultConfigPath,
  getGoodreadsAPIKey,
  getGoodreadsSecret,
  loadConfig
} from '../src/config';

const tmpFileAsync = promisify(tmp.file);
const writeFileAsync = promisify(fs.writeFile);

describe('config', function() {

  let sandbox: sinon.SinonSandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    if (sandbox) {
      sandbox.restore();
    }
  });

  describe('getDefaultConfigPath', function() {

    it('returns nothing when the environment variable is unset', function() {
      sandbox.stub(process, 'env').value({});
      assert.isUndefined(getDefaultConfigPath());
    });

    it('returns an expanded path when the environment variable is set', function() {
      sandbox.stub(process, 'env').value({
        GREADY_CONFIG: '/tmp/../var/config.json'
      });

      assert.equal(getDefaultConfigPath(), '/var/config.json');
    });

  });

  describe('getGoodreadsAPIKey', function() {

    it('returns the key when the environment variable is set', function() {
      sandbox.stub(process, 'env').value({
        GREADY_GOODREADS_API_KEY: 'key'
      });

      assert.equal(getGoodreadsAPIKey(), 'key');
    });

    it('throws an error when the environment variable is unset', function() {
      sandbox.stub(process, 'env').value({});

      assert.throws(
        () => getGoodreadsAPIKey(),
        OperationalError,
        /Goodreads API key/
      );
    });

  });

  describe('getGoodreadsSecret', function() {

    it('returns the secret when the environment variable is set', function() {
      sandbox.stub(process, 'env').value({
        GREADY_GOODREADS_SECRET: 'secret'
      });

      assert.equal(getGoodreadsSecret(), 'secret');
    });

    it('throws an error when the environment variable is unset', function() {
      sandbox.stub(process, 'env').value({});

      assert.throws(
        () => getGoodreadsSecret(),
        OperationalError,
        /Goodreads secret/
      );
    });

  });

  describe('loadConfig', function() {

    async function createConfig(config: UserConfiguration | string): Promise<string> {
      const configPath = await tmpFileAsync();

      await writeFileAsync(
        configPath,
        typeof config === 'string' ? config : JSON.stringify(config)
      );

      return configPath;
    }

    it('returns a valid config by default', async function() {
      const config = await loadConfig();

      assert.deepEqual(config.ignoreShelves, []);
      assert.deepEqual(config.mergePublishers, {});
      assert.deepEqual(config.mergeShelves, {});
    });

    it('can load a config file from a path', async function() {
      const configPath = await createConfig({
        ignoreShelves: ['shelf'],
        mergePublishers: { 'alfa': ['bravo'] },
        mergeShelves: { 'charlie': ['delta'] }
      })

      const config = await loadConfig(configPath);

      assert.deepEqual(config.ignoreShelves, ['shelf']);
      assert.deepEqual(config.mergePublishers, { 'alfa': ['bravo'] });
      assert.deepEqual(config.mergeShelves, { 'charlie': ['delta'] });
    });

    it('supports partial configs', async function() {
      const configPath = await createConfig({
        ignoreShelves: ['shelf']
      })

      const config = await loadConfig(configPath);

      assert.deepEqual(config.ignoreShelves, ['shelf']);
      assert.deepEqual(config.mergePublishers, {});
      assert.deepEqual(config.mergeShelves, {});
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
