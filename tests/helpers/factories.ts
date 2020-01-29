import * as API from '../../src/types/api';
import * as Core from '../../src/types/core';
import Bookshelf from '../../src/bookshelf';

let counter = 0;

const string = () => `S${++counter}`;

/**
 * Create a valid book as returned from the API
 */
export function createAPIBook(data?: Partial<API.Book>): API.Book {
  return {
    authors: {
      author: {
        id: string(),
        name: string()
      }
    },
    id: string(),
    popular_shelves: { shelf: [] },
    publisher: string(),
    reviews_widget: string(),
    title: string(),
    work: createAPIWork(),
    ...data
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
  id: string;
  ratingsCount: string;
  ratingsSum: string;
  title: string;
}> = {}): API.Book['work'] {
  return {
    id: { _: data.id || string() },
    original_title: data.title || string(),
    ratings_count: { _: data.ratingsCount || '1' },
    ratings_sum: { _: data.ratingsSum || '5' }
  };
}

/**
 * Create a valid book
 */
export function createBook(data?: Partial<Core.Book>): Core.Book {
  return {
    author: { id: string(), name: string() },
    averageRating: 5,
    canonicalID: string(),
    id: string(),
    publisher: string(),
    reviewsID: string(),
    shelves: [],
    similarBooks: [],
    title: string(),
    totalRatings: 0,
    workID: string(),
    ...data
  };
}

/**
 * Create a bookshelf with books
 */
export function createBookshelf(
  books: Partial<Core.Book>[] = [],
  shelfPercentile = 0
): Bookshelf {
  return new Bookshelf(
    books.map(createBook),
    { shelfPercentile }
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
