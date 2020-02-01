import http from 'http';
import nock, { BackMode } from 'nock';
import { chunk } from 'lodash';

import { canUpdateFixtures, shouldBypassFixtures } from './index';
import { paths } from '../../src/environment';

nock.back.fixtures = paths.networkFixturesDir;

nock.restore();

/**
 * Allow network access within a test context
 */
export function allowNetworkAccess(suite: Mocha.Suite, {
  always = false,
  timeout,
  useFixtures,
  when = () => true
}: {
  always?: boolean;
  timeout: number;
  useFixtures: boolean;
  when?: () => boolean;
}) {
  let previousMode: BackMode | undefined;
  let targetMode: BackMode;

  const allowRequests = always || (canUpdateFixtures() && when());
  const permitRequests = allowRequests || shouldBypassFixtures();

  if (shouldBypassFixtures()) {
    targetMode = 'wild';
  } else if (permitRequests) {
    targetMode = useFixtures ? 'record' : 'wild';
  } else {
    targetMode = 'lockdown';
  }

  suite.slow(Math.round(timeout * 0.95));
  suite.timeout(timeout);

  suite.beforeEach(function() {
    previousMode = nock.back.currentMode;
    nock.back.setMode(targetMode);

    if (permitRequests) {
      nock.enableNetConnect();
    }
  });

  suite.afterEach(function() {
    if (previousMode) {
      nock.back.setMode(previousMode);
    }

    nock.disableNetConnect();
  });
}

/**
 * Prevent network access
 */
export function preventNetworkAccess() {
  if (!nock.isActive()) {
    nock.activate();
  }

  nock.disableNetConnect();
  nock.back.setMode('lockdown');
}

/**
 * Restore network access
 */
export function restoreNetworkAccess() {
  nock.enableNetConnect();
  nock.back.setMode('record');

  nock.restore();
}

/**
 * Cause any requests made to a host to return a specific status code
 */
export function simulateResponse(
  host: string,
  response: {
    body?: string;
    headers?: Record<string, string>;
    status: number;
  },
  runTest: () => Promise<void>
): Promise<void> {
  nock(host)
    .get(uri => true)
    .reply(
      response.status,
      response.body,
      response.headers
    );

  return runTest();
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
