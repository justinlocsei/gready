import FSPersister from '@pollyjs/persister-fs';
import NodeHTTPAdapter from '@pollyjs/adapter-node-http';
import { Polly } from '@pollyjs/core';

import { paths } from '../../src/environment';

Polly.register(FSPersister);
Polly.register(NodeHTTPAdapter);

const IGNORE_HEADERS = [
  'set-cookie',
  'x-amz-rid',
  'x-request-id',
  'x-runtime'
];

/**
 * Use a fixture for all network interactions triggered by a function
 */
export async function useNetworkFixture(
  guid: string,
  runTest: () => Promise<void>
): Promise<void> {
  const polly = new Polly(guid, {
    adapters: ['node-http'],
    mode: process.env['GREADY_REFRESH_FIXTURES'] === '1' ? 'record' : 'replay',
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir: paths.testFixturesDir
      }
    }
  });

  const { server } = polly;

  server.any().on('beforeResponse', function(request, response) {
    response.removeHeaders(IGNORE_HEADERS);
  });

  await runTest();

  await polly.stop();
}
