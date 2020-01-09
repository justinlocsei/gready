import { normalizeString } from './data';

/**
 * Display an author's name in a last/first format if possible
 */
export function formalizeAuthorName(name: string): string {
  const parts = normalizeString(name).split(/\s+/);
  const totalParts = parts.length;

  const last = parts[totalParts - 1];
  const rest = parts.slice(0, totalParts - 1);

  return [last, rest.join(' ')].join(', ');
}
