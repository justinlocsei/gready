import FSPersister from '@pollyjs/persister-fs';
import http from 'http';
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

/**
 * Use a local server that responds with the given data
 */
export function useServer(
  status: number,
  headers: Record<string, string>,
  provideBody: (request: http.IncomingMessage) => string,
  runTest: (url: string) => Promise<void>
): Promise<void> {
  let error: Error | undefined;

  return new Promise(function(resolve, reject) {
    const server = http.createServer(function(request, response) {
      response.writeHead(status, headers);
      response.end(provideBody(request));
    });

    server.on('close', function() {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    server.listen(function() {
      const address = server.address();

      if (address && typeof address !== 'string') {
        runTest(`http://127.0.0.1:${address.port}`)
          .catch(e => error = e)
          .then(() => server.close());
      } else {
        error = new Error(`Invalid server address: ${address}`);
        server.close();
      }
    });
  });
}
