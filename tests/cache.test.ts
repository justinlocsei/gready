import tmp from 'tmp';

import assert from './helpers/assert';
import Cache, { ENCODINGS, Options } from '../src/cache';

describe('cache', function() {

  describe('Cache', function() {

    ENCODINGS.forEach(function(encoding) {

      context(`with ${encoding} encoding`, function() {

        let cacheDir: tmp.DirResult;

        beforeEach(function() {
          cacheDir = tmp.dirSync();
        });

        afterEach(function() {
          if (cacheDir) {
            cacheDir.removeCallback();
          }
        });

        function createCache(options: Partial<Options> = {}): Cache {
          return new Cache(cacheDir.name, { ...options, encoding });
        }

        describe('.clear', function() {

          it('can clear the cache', async function() {
            const cache = createCache();

            await cache.fetch(['alfa'], () => Promise.resolve('charlie'));
            await cache.clear();

            const value = await cache.fetch(['alfa'], () => Promise.resolve('delta'));
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

        describe('.stats', function() {

          it('lists all namespaces', async function() {
            const cache = createCache();

            const first = await cache.stats();

            await cache.fetch(['alfa', 'alfa'], () => Promise.resolve(''));
            await cache.fetch(['bravo', 'alfa'], () => Promise.resolve(''));
            await cache.fetch(['bravo', 'bravo'], () => Promise.resolve(''));

            const second = await cache.stats();

            assert.deepEqual(first, []);

            assert.deepEqual(second, [
              { items: 1, namespace: 'alfa' },
              { items: 2, namespace: 'bravo' }
            ]);
          });

        });

      });

    });

  });

});
