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
