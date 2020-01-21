import nock from 'nock';
import path from 'path';
import { chunk } from 'lodash';

const nockBack = nock.back;

nockBack.fixtures = path.join(
  path.normalize(path.join(__dirname, '..')),
  'fixtures'
);

nockBack.setMode('record');

const ALLOWED_HEADERS = [
  'Content-Encoding',
  'Content-Type',
  'Status',
  'Transfer-Encoding'
];

/**
 * Filter response headers to only include headers specified in a whitelist
 */
function filterResponseHeaders(headers: string[], whitelist: string[]): string[] {
  const allowed = new Set(whitelist);

  return chunk(headers, 2).reduce(function(previous, [header, value]) {
    if (allowed.has(header)) {
      previous.push(header);
      previous.push(value);
    }

    return previous;
  }, []);
}

/**
 * Normalize all recorded nock scopes
 */
function normalizeScopes(scopes: nock.Definition[], keepHeaders: string[]): nock.Definition[] {
  return scopes.map(function(scope): nock.Definition {
    return {
      ...scope,
      rawHeaders: scope.rawHeaders && filterResponseHeaders(scope.rawHeaders, keepHeaders)
    };
  });
}

/**
 * Use a fixture for all network interactions triggered by a function
 */
export function useNetworkFixture(
  partialPath: string,
  runAction: () => Promise<void>,
  options: {
    keepHeaders?: string[];
  } = {}
): Promise<void> {
  const fixturePath = `${partialPath}.json`;

  function afterRecord(scopes: nock.Definition[]) {
    return normalizeScopes(scopes, [
      ...ALLOWED_HEADERS,
      ...(options.keepHeaders || [])]
    );
  }

  return nockBack(fixturePath, { afterRecord }).then(async function({ context, nockDone }) {
    await runAction();

    context.assertScopesFinished();
    nockDone();
  });
}
