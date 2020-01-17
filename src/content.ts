/**
 * Extract all items at or above the given percentile
 */
export function extractPercentile<T>(
  items: T[],
  percentile: number,
  getValue: (item: T) => number
): T[] {
  if (!items.length || !percentile) {
    return items;
  } else if (percentile >= 100) {
    return [];
  }

  const values = items.map(getValue);
  const sortedValues = [...values].sort();

  const index = Math.ceil((percentile / 100) * (values.length - 1));
  const value = sortedValues[index];

  return items.filter(function(item, i) {
    return values[i] >= value;
  });
}

/**
 * Display an author's name in a last/first format if possible
 */
export function formalizeAuthorName(name: string): string {
  const parts = normalizeString(name).split(/\s+/);
  const totalParts = parts.length;

  const last = parts[totalParts - 1];
  const rest = parts.slice(0, totalParts - 1).join(' ');

  return [last, rest]
    .filter(Boolean)
    .join(', ');
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
