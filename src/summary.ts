import { sortBy } from 'lodash';

import Bookshelf from './bookshelf';
import { ExtractArrayType } from './types/util';
import { formalizeAuthorName } from './content';
import { underline } from './util';

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
 * Generate a printable summary of a bookshelf
 */
export function summarizeBookshelf(bookshelf: Bookshelf, {
  sections
}: {
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
      body: summarizeBooksByAuthor(bookshelf),
      title: 'Books by Author'
    });
  }

  if (showSections['books-by-publisher']) {
    parts.push({
      body: summarizeBooksByPublisher(bookshelf),
      title: 'Books by Publisher'
    });
  }

  if (showSections['publishers']) {
    parts.push({
      body: summarizePublishers(bookshelf),
      title: 'All Publishers'
    });
  }

  if (showSections['popular-shelves']) {
    parts.push({
      body: summarizePopularShelves(bookshelf),
      title: 'Popular Shelves'
    });
  }

  if (showSections['shelves']) {
    parts.push({
      body: summarizeShelves(bookshelf),
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
function summarizeBooksByAuthor(bookshelf: Bookshelf): string {
  return bookshelf
    .groupByAuthor()
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
function summarizeBooksByPublisher(bookshelf: Bookshelf): string {
  return bookshelf
    .groupByPublisher()
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
function summarizePopularShelves(bookshelf: Bookshelf): string {
  return bookshelf
    .groupByShelf()
    .map(function({ books: bs, percentile, shelfName, totalCount }) {
      return [
        `* ${shelfName} (${percentile}%)`,
        ...bs.map(b => `  - ${b.book.title} (${b.percentile}%)`)
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Summarize the publishers for a set of books
 */
function summarizePublishers(bookshelf: Bookshelf): string {
  return bookshelf
    .groupByPublisher()
    .map(b => `* ${b.publisherName} (${b.books.length})`)
    .join('\n');
}

/**
 * Summarize the shelves for a set of books
 */
function summarizeShelves(bookshelf: Bookshelf): string {
  const shelves = sortBy(
    bookshelf.groupByShelf(),
    [
      s => s.shelfName,
      s => s.percentile * -1
    ]
  );

  return shelves
    .map(function({ percentile, shelfName }) {
      return `* ${shelfName} (${percentile}%)`;
    })
    .join('\n');
}
