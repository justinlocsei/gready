import assert from './helpers/assert';
import { makeGetRequest } from '../src/network';
import { NetworkError } from '../src/errors';
import { useServer } from './helpers/requests';

describe('network', function() {

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
