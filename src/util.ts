/**
 * Ensure that a value is an array
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Whether a value is numeric
 */
export function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Apply a mapping function to an array if it is defined
 */
export function maybeMap<T, U>(
  value: T[] | undefined,
  transform: (v: T) => U
): U[] | undefined {
  return value && value.map(transform);
}

/**
 * A function that should never be called
 */
export function unreachable(reason: never): never {
  throw new Error(reason);
}
