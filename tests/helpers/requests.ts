import http from 'http';
import nock from 'nock';
import { chunk } from 'lodash';

import { allowNetworkTests } from './index';
import { paths } from '../../src/environment';

const nockBack = nock.back;

nockBack.fixtures = paths.networkFixturesDir;
nockBack.setMode(allowNetworkTests() ? 'record' : 'lockdown');

nock.restore();

/**
 * Remove unwanted headers from a flattened list of name/value data
 */
function filterHeaders(headers: string[], remove: string[]): string[] {
  const forbidden = new Set(remove.map(h => h.toLowerCase()));

  return chunk(headers, 2).reduce(function(previous, [header, value]) {
    if (!forbidden.has(header.toLowerCase())) {
      previous.push(header);
      previous.push(value);
    }

    return previous;
  }, []);
}

/**
 * Use a fixture for all network interactions triggered by a function
 */
export async function useNetworkFixture(
  guid: string,
  runTest: () => Promise<void>,
  options: {
    removeHeaders?: string[];
  } = {}
): Promise<void> {
  if (!nock.isActive()) {
    nock.activate();
  }

  const { context, nockDone } = await nockBack(`${guid}.json`, {
    afterRecord: function(defs) {
      return defs.map(function(def): nock.Definition {
        return {
          ...def,
          rawHeaders: def.rawHeaders && filterHeaders(def.rawHeaders, options.removeHeaders || [])
        };
      });
    }
  });

  await runTest();

  context.assertScopesFinished();
  nockDone();

  nock.restore();
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
