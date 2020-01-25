import sinon from 'sinon';

let hasStubHandler = false;
const stubs = new Set<sinon.SinonStub>();

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

/**
 * Replace a method on an object with a custom implementation
 */
export function replaceMethod<T, K extends keyof T>(
  object: T,
  method: K,
  impl: T[K] extends (...args: infer U) => infer V ? (...args: U) => V : never
): void {
  const stub = sinon.stub(object, method);
  stub.callsFake(impl);

  stubs.add(stub);

  if (!hasStubHandler) {
    afterEach(function() {
      stubs.forEach(s => s.restore());
      stubs.clear();
    });
  }

  hasStubHandler = true;
}
