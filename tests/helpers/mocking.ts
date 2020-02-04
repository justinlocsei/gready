import sinon from 'sinon';
import { isFunction } from 'lodash';

/**
 * Expose functions for overriding behavior in tests
 */
export function allowOverrides(suite: Mocha.Suite) {
  let sandbox: sinon.SinonSandbox | undefined;
  const stubs = new WeakMap<object, Map<any, sinon.SinonStub>>();

  suite.beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  suite.afterEach(function() {
    if (sandbox) {
      sandbox.restore();
    }
  });

  return function<T extends object, K extends keyof T>(
    object: T,
    property: K,
    impl: T[K] extends (...args: infer U) => infer V ? (...args: U) => V : T[K]
  ): void {
    if (!sandbox) {
      throw new Error('No sandbox available for stubbing');
    }

    let objStubs = stubs.get(object);

    if (!objStubs) {
      objStubs = new Map();
      stubs.set(object, objStubs);
    }

    const objStub = objStubs.get(property);

    if (objStub) {
      objStub.restore();
    }

    const replacement = sandbox.stub(object, property);

    if (isFunction(impl)) {
      replacement.callsFake(impl);
    } else {
      replacement.value(impl);
    }

    objStubs.set(property, replacement);
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
