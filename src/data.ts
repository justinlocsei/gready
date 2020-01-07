/**
 * Ensure that a value is an array
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * A function that should never be called
 */
export function unreachable(param: never) {}
