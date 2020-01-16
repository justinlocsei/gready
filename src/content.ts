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
