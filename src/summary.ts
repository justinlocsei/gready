import { sortBy } from 'lodash';

import { Book } from './types/data';
import { ExtractArrayType } from './types/core';
import { formalizeAuthorName } from './content';
import { groupBooksByAuthor, groupBooksByPublisher, groupBooksByShelf } from './analysis';
import { underline } from './data';

export const SECTION_IDS = [
  'books-by-author',
  'books-by-publisher',
  'popular-shelves',
  'publishers',
  'shelves'
] as const;

export type SectionID = ExtractArrayType<typeof SECTION_IDS>;

interface Section {
  body: string;
  title: string;
}

/**
 * Generate a printable summary of books
 */
export function summarizeBooks(books: Book[], {
  minShelfPercent,
  sections
}: {
  minShelfPercent: number;
  sections?: SectionID[];
}): string {
  const parts: Section[] = [];
  const sectionIDs = new Set(sections || SECTION_IDS);

  const showSections: Record<SectionID, boolean> = SECTION_IDS.reduce(function(previous: Record<string, boolean>, id) {
    previous[id] = sectionIDs.has(id);
    return previous;
  }, {});

  if (showSections['books-by-author']) {
    parts.push({
      body: summarizeBooksByAuthor(books),
      title: 'Books by Author'
    });
  }

  if (showSections['books-by-publisher']) {
    parts.push({
      body: summarizeBooksByPublisher(books),
      title: 'Books by Publisher'
    });
  }

  if (showSections['publishers']) {
    parts.push({
      body: summarizePublishers(books),
      title: 'All Publishers'
    });
  }

  if (showSections['popular-shelves']) {
    parts.push({
      body: summarizePopularShelves(books, minShelfPercent),
      title: 'Popular Shelves'
    });
  }

  if (showSections['shelves']) {
    parts.push({
      body: summarizeShelves(books, minShelfPercent),
      title: 'All Shelves'
    });
  }

  return parts
    .map(({ body, title }) => `${underline(title)}\n\n${body}`)
    .join('\n\n');
}

/**
 * Summarize books by author
 */
function summarizeBooksByAuthor(books: Book[]): string {
  return groupBooksByAuthor(books)
    .map(function({ author, books: bs }) {
      return [
        `* ${formalizeAuthorName(author.name)} (ID=${author.id})`,
        ...bs.map(b => `  - ${b.title} (ID=${b.id})`)
      ].join('\n');
    })
    .join('\n\n')
}

/**
 * Summarize books by publisher
 */
function summarizeBooksByPublisher(books: Book[]): string {
  return groupBooksByPublisher(books)
    .map(function({ books: bs, publisherName }) {
      return [
        `* ${publisherName}`,
        ...bs.map(b => `  - ${b.title}`)
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Summarize the popular shelves for a set of books
 */
function summarizePopularShelves(books: Book[], minPercent: number): string {
  return groupBooksByShelf(books, { minPercent })
    .map(function({ books: bs, popularity, shelfName, totalCount }) {
      return [
        `* ${shelfName} (${popularity}%)`,
        ...bs.map(b => `  - ${b.book.title} (${b.affinity}%)`)
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Summarize the publishers for a set of books
 */
function summarizePublishers(books: Book[]): string {
  return groupBooksByPublisher(books)
    .map(b => `* ${b.publisherName} (${b.books.length})`)
    .join('\n');
}

/**
 * Summarize the shelves for a set of books
 */
function summarizeShelves(books: Book[], minPercent: number): string {
  const shelves = sortBy(
    groupBooksByShelf(books, { minPercent }),
    [
      s => s.shelfName,
      s => s.popularity * -1
    ]
  );

  return shelves
    .map(function({ popularity, shelfName }) {
      return `* ${shelfName} (${popularity}%)`;
    })
    .join('\n');
}
