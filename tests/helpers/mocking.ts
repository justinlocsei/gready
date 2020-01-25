import sinon from 'sinon';

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
export function mockMethod<T, K extends keyof T>(
  object: T,
  method: K,
  impl: T[K] extends (...args: infer U) => infer V ? (...args: U) => V : never
): void {
  sinon.stub(object, method).callsFake(impl);
}
