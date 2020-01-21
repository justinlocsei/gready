import fs from 'graceful-fs';
import sinon from 'sinon';
import tmp from 'tmp';
import { promisify } from 'util';

import assert from './helpers/assert';
import { OperationalError } from '../src/errors';
import { UserConfiguration } from '../src/types/config';

import {
  getGoodreadsAPIKey,
  getGoodreadsUserID,
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

  describe('getGoodreadsUserID', function() {

    it('returns the user ID when the environment variable is set', function() {
      sandbox.stub(process, 'env').value({
        GREADY_GOODREADS_USER_ID: 'id'
      });

      assert.equal(getGoodreadsUserID(), 'id');
    });

    it('throws an error when the environment variable is unset', function() {
      sandbox.stub(process, 'env').value({});

      assert.throws(
        () => getGoodreadsUserID(),
        OperationalError,
        /Goodreads user ID/
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

    it('allows the config file to be missing', async function() {
      const config = await loadConfig('/missing.json', { allowMissing: true });

      assert.deepEqual(config.ignoreShelves, []);
      assert.deepEqual(config.mergePublishers, {});
      assert.deepEqual(config.mergeShelves, {});
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
