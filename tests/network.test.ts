import nock from 'nock';

import assert from './assert';
import { makeGetRequest } from '../src/network';

describe('network', function() {

  describe('makeGetRequest', function() {

    it('returns the text of a response', async function() {
      nock('http://example.com')
        .get('/test')
        .reply(200, 'response');

      assert.equal(
        await makeGetRequest('http://example.com/test'),
        'response'
      );
    });

    it('handles errors', async function() {
      nock('http://example.com')
        .get('/test')
        .reply(500);

      assert.isRejected(
        makeGetRequest('http://example.com/test'),
        /example\.com\/test failed:/
      );
    });

  });

});
