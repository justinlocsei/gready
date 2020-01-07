import stringifyJSON from 'json-stable-stringify';

/**
 * Format a value as a JSON string
 */
export function formatJSON(value: any): string {
  return stringifyJSON(value, { space: 2 });
}
