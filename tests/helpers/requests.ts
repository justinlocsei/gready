import http from 'http';
import nock, { BackMode } from 'nock';
import { chunk } from 'lodash';

import { canUpdateFixtures } from './index';
import { paths } from '../../src/environment';

nock.back.fixtures = paths.networkFixturesDir;

nock.restore();

/**
 * Configure a test's network access
 */
export function configureNetworkAccess(suite: Mocha.Suite, {
  allowRequests = canUpdateFixtures(),
  timeout,
  useFixtures = true
}: {
  allowRequests?: boolean;
  timeout: number;
  useFixtures?: boolean;
}): void {
  let previousMode: BackMode | undefined;
  let targetMode: BackMode;

  if (allowRequests) {
    targetMode = useFixtures ? 'record' : 'wild';
  } else {
    targetMode = 'lockdown';
  }

  suite.slow(Math.round(timeout * 0.95));
  suite.timeout(timeout);

  suite.beforeEach(function() {
    previousMode = nock.back.currentMode;
    nock.back.setMode(targetMode);

    if (!nock.isActive()) {
      nock.activate();
    }

    if (!allowRequests) {
      nock.disableNetConnect();
    }
  });

  suite.afterEach(function() {
    if (previousMode) {
      nock.back.setMode(previousMode);
    }

    if (!allowRequests) {
      nock.enableNetConnect();
    }

    nock.restore();
  });
}

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

  const { context, nockDone } = await nock.back(`${guid}.json`, {
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