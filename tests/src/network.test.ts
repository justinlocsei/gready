import assert from '../helpers/assert';
import { allowNetworkAccess, useServer } from '../helpers/requests';
import { handleRequestErrors, makeGetRequest } from '../../src/network';
import { NetworkError } from '../../src/errors';

describe('network', function() {

  allowNetworkAccess(this, {
    always: true,
    timeout: 1000,
    useFixtures: false
  });

  describe('handleRequestErrors', function() {

    it('returns the result of a successful request', function() {
      return useServer(
        200,
        {},
        () => 'Alfa',
        async function(url) {
          const result = await handleRequestErrors(
            () => makeGetRequest(url),
            () => Promise.resolve('Bravo')
          );

          assert.equal(result, 'Alfa');
        });
    });

    it('returns the fallback branch when a network error occurs', function() {
      return useServer(
        500,
        {},
        () => 'Alfa',
        async function(url) {
          const result = await handleRequestErrors(
            () => makeGetRequest(url),
            () => Promise.resolve('Bravo')
          );

          assert.equal(result, 'Bravo');
        });
    });

    it('throws an error when the request function throws a non-network error', function() {
      return useServer(
        200,
        {},
        () => 'Alfa',
        async function(url) {
          await assert.isRejected(
            handleRequestErrors(
              () => { throw new Error('Alfa'); },
              () => Promise.resolve('Bravo')
            ),
            'Alfa'
          );
        });
    });

  });

  describe('makeGetRequest', function() {

    it('returns the text of a successful response', function() {
      return useServer(
        200,
        {},
        () => 'Response',
        async function(url) {
          assert.equal(
            await makeGetRequest(url),
            'Response'
          );
        });
    });

    it('returns the text of an XML response', function() {
      return useServer(
        200,
        { 'Content-Type': 'application/xml' },
        () => '<Testing></Testing>',
        async function(url) {
          assert.equal(
            await makeGetRequest(url),
            '<Testing></Testing>'
          );
        });
    });

    it('supports setting a payload', function() {
      return useServer(
        200,
        {},
        function(request) {
          return request.url
            ? request.url.replace(/.*\?/, '')
            : '';
        },
        async function(url) {
          assert.equal(
            await makeGetRequest(url, { key: 'value' }),
            'key=value'
          );
        });
    });

    it('handles errors', function() {
      return useServer(
        404,
        {},
        () => 'Not found',
        async function(url) {
          await assert.isRejected(
            makeGetRequest(url),
            /failed/
          );
        });
    });

    it('exposes the status of a failed request', function() {
      return useServer(
        500,
        {},
        () => 'Server error',
        function(url) {
          return makeGetRequest(url).then(
            function() {
              assert.fail('unexpected request success');
            },
            function(error) {
              assert.instanceOf(error, NetworkError);
              assert.equal(error.statusCode, 500);
            }
          );
        });
    });

  });

});
