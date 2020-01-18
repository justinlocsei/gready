import tmp from 'tmp';

import assert from './assert';
import Cache, { Options } from '../src/cache';

describe('cache/Cache', function() {

  let cacheDir: tmp.DirResult;

  beforeEach(function() {
    cacheDir = tmp.dirSync();
  });

  afterEach(function() {
    if (cacheDir) {
      cacheDir.removeCallback();
    }
  });

  function createCache(options?: Options): Cache {
    return new Cache(cacheDir.name, options);
  }

  describe('.clear', function() {

    it('can clear the cache', async function() {
      const cache = createCache();

      await cache.fetch(['alfa'], () => Promise.resolve('charlie'));
      await cache.clear();

      const value = await cache.fetch(['alfa'], () => Promise.resolve('delta'))
      assert.equal(value, 'delta');
    });

    it('can clear a set of namespaces', async function() {
      const cache = createCache();

      const alfaOne = await cache.fetch(['alfa', 'bravo'], () => Promise.resolve('before'));
      const charlieOne = await cache.fetch(['charlie', 'delta'], () => Promise.resolve('before'));

      await cache.clear(['charlie']);

      const alfaTwo = await cache.fetch(['alfa', 'bravo'], () => Promise.resolve('after'));
      const charlieTwo = await cache.fetch(['charlie', 'delta'], () => Promise.resolve('after'));

      assert.equal(alfaOne, 'before');
      assert.equal(charlieOne, 'before');
      assert.equal(alfaTwo, 'before');
      assert.equal(charlieTwo, 'after');
    });

  });

  describe('.entries', function() {

    it('lists all entries in a given namespace', async function() {
      const cache = createCache();

      const first = await cache.entries(['alfa']);

      await cache.fetch(['alfa', 'bravo'], () => Promise.resolve('bravo'));
      await cache.fetch(['alfa', 'charlie'], () => Promise.resolve('charlie'));

      const second = await cache.entries(['alfa']);

      assert.deepEqual(first, []);
      assert.deepEqual(second, ['bravo', 'charlie']);
    });

  });

  describe('.fetch', function() {

    it('calculates a value', async function() {
      const cache = createCache();

      const result = await cache.fetch(
        ['alfa'],
        () => Promise.resolve('bravo')
      );

      assert.equal(result, 'bravo');
    });

    it('supports namespaces', async function() {
      const cache = createCache();

      const result = await cache.fetch(
        ['alfa', 'bravo'],
        () => Promise.resolve('charlie')
      );

      assert.equal(result, 'charlie');
    });

    it('uses a cached value', async function() {
      const cache = createCache();

      const first = await cache.fetch(
        ['alfa'],
        () => Promise.resolve('bravo')
      );

      const second = await cache.fetch(
        ['alfa'],
        () => Promise.resolve('charlie')
      );

      assert.equal(first, 'bravo');
      assert.equal(second, 'bravo');
    });

    it('can bypass the cache', async function() {
      const cache = createCache({ enabled: false });

      const first = await cache.fetch(
        ['alfa'],
        () => Promise.resolve('bravo')
      );

      const second = await cache.fetch(
        ['alfa'],
        () => Promise.resolve('charlie')
      );

      assert.equal(first, 'bravo');
      assert.equal(second, 'charlie');
    });

  });

});