import assert from './assert';
import { createTestLogger } from './helpers';
import { getLevelNames } from '../src/logger';

describe('logger', function() {

  describe('getLevelNames', function() {

    it('exposes the level names', function() {
      assert.deepEqual(
        getLevelNames(),
        ['debug', 'info', 'none']
      );
    });

  });

  describe('Logger', function() {

    describe('.debug', function() {

      it('logs a debug message', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'debug' });

        logger.debug('alfa');
        logger.debug('bravo', 'charlie');

        const messages = await readLog();

        assert.deepEqual(messages, [
          '[DEBUG] alfa',
          '[DEBUG] bravo | charlie'
        ]);
      });

      it('shows all log levels', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'debug' });

        logger.debug('alfa');
        logger.info('bravo');

        assert.deepEqual(await readLog(), [
          '[DEBUG] alfa',
          '[INFO ] bravo'
        ]);
      });

      it('is ignored when the logger is disabled', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'none' });

        logger.debug('alfa');
        assert.deepEqual(await readLog(), []);
      });

      it('can produce colorized output', async function() {
        const [color, readColorLogs] = createTestLogger({ logLevel: 'debug', useColor: true });
        const [plain, readPlainLogs] = createTestLogger({ logLevel: 'debug', useColor: false });

        color.debug('alfa');
        plain.debug('alfa');

        const [colorText] = await readColorLogs();
        const [plainText] = await readPlainLogs();

        assert.equal(plainText, '[DEBUG] alfa');
        assert.notEqual(colorText, '[DEBUG] alfa');
        assert.match(colorText, /\[DEBUG\] alfa/);
      });

    });

    describe('.info', function() {

      it('logs an info message', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'info' });

        logger.info('alfa');
        logger.info('bravo', 'charlie');

        const messages = await readLog();

        assert.deepEqual(messages, [
          '[INFO] alfa',
          '[INFO] bravo | charlie'
        ]);
      });

      it('hides debug messages', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'info' });

        logger.debug('alfa');
        logger.info('bravo');

        assert.deepEqual(await readLog(), [
          '[INFO] bravo'
        ]);
      });

      it('is ignored when the logger is disabled', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'none' });

        logger.info('alfa');
        assert.deepEqual(await readLog(), []);
      });

      it('ignores color options', async function() {
        const [color, readColorLogs] = createTestLogger({ logLevel: 'info', useColor: true });
        const [plain, readPlainLogs] = createTestLogger({ logLevel: 'info', useColor: false });

        color.info('alfa');
        plain.info('alfa');

        const [colorText] = await readColorLogs();
        const [plainText] = await readPlainLogs();

        assert.equal(plainText, colorText);
      });

    });

    describe('.indent', function() {

      it('updates the indentation level', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'info' });

        logger.info('alfa');
        logger.indent(2);
        logger.info('bravo');
        logger.indent(3);
        logger.info('charlie');

        assert.deepEqual(await readLog(), [
          '[INFO] alfa',
          '[INFO]   bravo',
          '[INFO]      charlie'
        ]);
      });

    });

    describe('.isEnabled', function() {

      it('is true when the log level is set to a non-null value', function() {
        const [info] = createTestLogger({ logLevel: 'info' });
        const [debug] = createTestLogger({ logLevel: 'debug' });

        assert.isTrue(info.isEnabled);
        assert.isTrue(debug.isEnabled);
      });

      it('is false when the log level is none', function() {
        const [logger] = createTestLogger({ logLevel: 'none' });

        assert.isFalse(logger.isEnabled);
      });

    });

    describe('.log', function() {

      function sleep(timeout: number): Promise<void> {
        return new Promise(function(resolve) {
          setTimeout(resolve, timeout);
        });
      }

      it('support a named log level', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'debug' });

        logger.log('debug', ['alfa']);
        logger.log('info', ['bravo', 'charlie']);

        assert.deepEqual(await readLog(), [
          '[DEBUG] alfa',
          '[INFO ] bravo | charlie'
        ]);
      });

      it('can show the elapsed time between statements', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'info', showTime: true });

        logger.log('info', ['alfa']);
        await sleep(10);
        logger.log('info', ['bravo']);

        const [first, last] = await readLog();

        assert.match(first, /^\s+0ms \[INFO\] alfa/);
        assert.match(last, /\d{2,}ms \[INFO\] bravo/);
      });

      it('respects color options when showing the elapsed time', async function() {
        const [color, readColorLog] = createTestLogger({ logLevel: 'info', showTime: true, useColor: true });
        const [plain, readPlainLog] = createTestLogger({ logLevel: 'info', showTime: true, useColor: false });

        color.log('info', ['alfa']);
        plain.log('info', ['alfa']);

        const [colorText] = await readColorLog();
        const [plainText] = await readPlainLog();

        assert.notEqual(plainText, colorText);
        assert.match(plainText, /^\s+0ms \[INFO\] alfa/);
        assert.match(colorText, /0ms/);
        assert.match(colorText, /\[INFO\] alfa/);
      });

    });

    describe('.outdent', function() {

      it('updates the indentation level', async function() {
        const [logger, readLog] = createTestLogger({ logLevel: 'info' });

        logger.info('alfa');
        logger.indent(2);
        logger.info('bravo');
        logger.outdent(1);
        logger.info('charlie');

        assert.deepEqual(await readLog(), [
          '[INFO] alfa',
          '[INFO]   bravo',
          '[INFO]  charlie'
        ]);
      });

    });

  });

});
