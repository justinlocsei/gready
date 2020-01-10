/**
 * Ensure that a value is an array
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Whether a value is numeric
 */
export function isNumeric(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Remove non-essential information from a string
 */
export function normalizeString(value: string): string {
  return value
    .trim()
    .replace(/\s{2,}/g, ' ');
}

/**
 * Underline a string
 */
export function underline(value: string, character = '='): string {
  return `${value}\n${character.repeat(value.length)}`;
}

/**
 * A function that should never be called
 */
export function unreachable(reason: never): never {
  throw new Error(reason);
}
