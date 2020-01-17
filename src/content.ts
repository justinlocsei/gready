import { uniq } from 'lodash';

import { Partitioned } from './types/util';

/**
 * Apply a percentile to each item in a list based on its value, using a
 * cumulative distribution function
 */
export function partition<T>(
  items: T[],
  getValue: (item: T) => number
): Partitioned<T>[] {
  const values = items.map(getValue);
  const sortedValues = uniq([...values]).sort();
  const totalValues = sortedValues.length;

  const percentiles = sortedValues.reduce(function(previous: Record<number, number>, value) {
    const below = sortedValues.filter(v => v <= value).length;
    previous[value] = below && Math.round((below / totalValues) * 100);

    return previous;
  }, {});

  return items.map(function(item, i): Partitioned<T> {
    return {
      data: item,
      percentile: percentiles[values[i]]
    };
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
