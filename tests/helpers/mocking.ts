import sinon from 'sinon';
import { isFunction } from 'lodash';

import assert from './assert';

/**
 * Expose functions for overriding behavior in tests
 */
export function allowOverrides(suite: Mocha.Suite) {
  let sandbox: sinon.SinonSandbox | undefined;

  suite.beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  suite.afterEach(function() {
    if (sandbox) {
      sandbox.restore();
    }
  });

  function expectAssertions(count: number) {
    const assertions: (undefined | (() => void))[] = [];

    return {
      assert: function(assertion: () => void) {
        assertions.push(assertion);
      },
      checkpoint: function() {
        assertions.push(undefined);
      },
      verify: function() {
        assert.equal(assertions.length, count, 'The expected number of assertions was not made');

        assertions.forEach(function(assertion) {
          if (assertion) {
            assertion();
          }
        });
      }
    };
  }

  function mock(object: any) {
    if (!sandbox) {
      throw new Error('No sandbox available for mocking');
    }

    return sandbox.mock(object);
  }

  function stub<T, K extends keyof T>(
    object: T,
    property: K,
    impl: T[K] extends (...args: infer U) => infer V ? (...args: U) => V : T[K]
  ): void {
    if (!sandbox) {
      throw new Error('No sandbox available for stubbing');
    }

    const replacement = sandbox.stub(object, property);

    if (isFunction(impl)) {
      replacement.callsFake(impl);
    } else {
      replacement.value(impl);
    }
  }

  return {
    expectAssertions,
    mock,
    stub
  };
}

/**
 * Freeze time inside of a function
 */
export function freezeTime(timestamp: number, runTest: () => any): void {
  const originalDateNow = Date.now;

  Date.now = () => timestamp;

  try {
    runTest();
  } finally {
    Date.now = originalDateNow;
  }
}
