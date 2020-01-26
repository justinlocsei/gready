import * as API from '../../src/types/api';
import * as Core from '../../src/types/core';
import Bookshelf from '../../src/bookshelf';

/**
 * Create a valid book as returned from the API
 */
export function createAPIBook(data?: Partial<API.Book>): API.Book {
  return {
    authors: {
      author: {
        id: '1',
        name: 'Author'
      }
    },
    id: '1',
    popular_shelves: {
      shelf: {
        $: {
          count: '1',
          name: 'Shelf'
        }
      }
    },
    publisher: 'Publisher',
    reviews_widget: '',
    title: 'Title',
    work: createAPIWork({
      id: '1',
      ratingsCount: '1',
      ratingsSum: '1',
      title: 'Title'
    }),
    ...data
  };
}

/**
 * Create a valid read book as returned from the API
 */
export function createAPIReadBook(data?: Partial<API.ReadBook>): API.ReadBook {
  return {
    book: {
      id: { _: '1' },
      publisher: 'Publisher',
      work: { id: '1' }
    },
    date_added: 'Tue Dec 31 12:00:00 -0500 2019',
    id: '1',
    rating: '5',
    read_at: 'Tue Dec 31 12:00:00 -0500 2019',
    shelves: {
      shelf: {
        $: { name: 'shelf' }
      }
    },
    ...data
  };
}


/**
 * Create a valid review as returned from the API
 */
export function createAPIReview(data?: Partial<API.Review>): API.Review {
  return {
    ...createAPIReadBook(data),
    user: {
      id: '1',
      link: '',
      name: 'User'
    },
    ...data
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
    id: { _: data.id || '1' },
    original_title: data.title || 'Title',
    ratings_count: { _: data.ratingsCount || '1' },
    ratings_sum: { _: data.ratingsSum || '1' }
  };
}

/**
 * Create a valid book
 */
export function createBook(data?: Partial<Core.Book>): Core.Book {
  return {
    author: { id: '1', name: 'Author Name' },
    averageRating: 1,
    canonicalID: '1',
    id: '1',
    publisher: 'Publisher',
    reviewsID: '1',
    shelves: [],
    similarBooks: [],
    title: 'Title',
    totalRatings: 0,
    workID: '1',
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
  return {
    bookID: '1',
    id: '2',
    posted: 0,
    rating: 5,
    shelves: [],
    ...data
  };
}
