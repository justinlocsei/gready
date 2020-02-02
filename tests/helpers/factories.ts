import * as API from '../../src/types/api';
import * as bookshelf from '../../src/bookshelf';
import * as Core from '../../src/types/core';
import { createTestConfig } from './index';
import { UserConfiguration } from '../../src/types/config';

let counter = 0;

const string = () => `S${++counter}`;

/**
 * Create a valid book as returned from the API
 */
export function createAPIBook(data: Partial<API.Book> = {}): API.Book {
  const id = data.id || string();

  return {
    authors: {
      author: {
        id: string(),
        name: string()
      }
    },
    popular_shelves: { shelf: [] },
    publisher: string(),
    reviews_widget: string(),
    title: string(),
    work: createAPIWork({
      bestBookID: id
    }),
    ...data,
    id
  };
}

/**
 * Create a valid read book as returned from the API
 */
export function createAPIReadBook(data?: Partial<API.ReadBook>): API.ReadBook {
  return {
    book: {
      id: { _: string() },
      publisher: string(),
      work: { id: string() }
    },
    date_added: 'Tue Dec 31 12:00:00 -0500 2019',
    id: string(),
    rating: '5',
    read_at: 'Tue Dec 31 12:00:00 -0500 2019',
    shelves: { shelf: [] },
    ...data
  };
}

/**
 * Create a valid review as returned from the API
 */
export function createAPIReview(data?: Partial<API.Review>): API.Review {
  return {
    user: {
      id: string(),
      link: string(),
      name: string()
    },
    ...createAPIReadBook(data)
  };
}

/**
 * Create a work definition as returned from the API
 */
export function createAPIWork(data: Partial<{
  bestBookID: string;
  id: string;
  ratingsCount: string;
  ratingsSum: string;
  title: string;
}> = {}): API.Book['work'] {
  return {
    best_book_id: { _: data.bestBookID || string() },
    id: { _: data.id || string() },
    original_title: data.title || string(),
    ratings_count: { _: data.ratingsCount || '1' },
    ratings_sum: { _: data.ratingsSum || '5' }
  };
}

/**
 * Create a valid book
 */
export function createBook(data: Partial<Core.Book> = {}): Core.Book {
  const id = data.id || string();

  return {
    author: { id: string(), name: string() },
    averageRating: 5,
    canonicalID: id,
    publisher: string(),
    reviewsID: string(),
    shelves: [],
    similarBooks: [],
    title: string(),
    totalRatings: 0,
    workID: string(),
    ...data,
    id
  };
}

/**
 * Create a bookshelf with books
 */
export function createBookshelf(
  books: Partial<Core.Book>[] = [],
  config?: UserConfiguration
): bookshelf.Bookshelf {
  return bookshelf.createBookshelf(
    books.map(createBook),
    createTestConfig(config)
  );
}

/**
 * Create a valid read book
 */
export function createReadBook(data?: Partial<Core.ReadBook>): Core.ReadBook {
  return createReview(data);
}

/**
 * Create a valid review
 */
export function createReview(data?: Partial<Core.Review>): Core.Review {
  return {
    bookID: string(),
    id: string(),
    posted: 0,
    rating: 5,
    shelves: [],
    user: createUser(),
    ...data
  };
}

/**
 * Create a valid user
 */
export function createUser(data?: Partial<Core.User>): Core.User {
  return {
    id: string(),
    name: string(),
    profileURL: string(),
    ...data
  };
}
