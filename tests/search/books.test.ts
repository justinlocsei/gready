import * as goodreads from '../../src/goodreads';
import assert from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';
import { Book, ReadBook } from '../../src/types/core';
import { BookID } from '../../src/types/goodreads';
import { configureNetworkAccess } from '../helpers/requests';
import { createBook, createReadBook } from '../helpers/factories';
import { createTestRepo } from '../helpers';
import { findRecommendedBooks, PartitionedRecommendation, summarizeRecommendedBooks } from '../../src/search/books';

describe('search/books', function() {

  configureNetworkAccess(this, {
    allowRequests: false,
    timeout: this.timeout(),
    useFixtures: false
  });

  const { stub } = allowOverrides(this);

  describe('findRecommendedBooks', function() {

    async function getRecommendedBooks({
      books,
      coreBookIDs,
      minRating = 1,
      percentile = 0,
      readBooks,
      shelfPercentile = 0,
      shelves
    }: {
      books: Partial<Book>[];
      coreBookIDs?: BookID[];
      minRating?: number;
      percentile?: number;
      readBooks: Partial<ReadBook>[];
      shelfPercentile?: number;
      shelves?: string[];
    }) {
      const repo = createTestRepo();
      const allBooks = books.map(createBook);

      stub(repo, 'getBook', function(id) {
        const book = allBooks.find(b => b.id === id);

        if (book) {
          return Promise.resolve(book);
        } else {
          throw new Error(`Unknown book: ${id}`);
        }
      });

      const recs = await findRecommendedBooks({
        coreBookIDs,
        minRating,
        percentile,
        readBooks: readBooks.map(createReadBook),
        repo,
        shelfPercentile,
        shelves
      });

      return recs.map(function({ data, percentile }) {
        return {
          bookID: data.book.id,
          count: data.recommendations,
          percentile
        };
      });
    }

    it('finds recommendations in a set of books', async function() {
      const books = await getRecommendedBooks({
        books: [
          {
            id: '1',
            similarBooks: ['2', '4']
          },
          {
            id: '3',
            similarBooks: ['2']
          },
          {
            id: '5',
            similarBooks: ['2', '4']
          },
          {
            id: '4'
          },
          {
            id: '2'
          }
        ],
        readBooks: [
          { bookID: '1', rating: 5 },
          { bookID: '3', rating: 4 },
          { bookID: '5', rating: 3 }
        ]
      });

      assert.deepEqual(books, [
        { bookID: '2', count: 3, percentile: 100 },
        { bookID: '4', count: 2, percentile: 50 }
      ]);
    });

    it('can restrict recommendations by rating', async function() {
      const books = await getRecommendedBooks({
        books: [
          {
            id: '1',
            similarBooks: ['2']
          },
          {
            id: '3',
            similarBooks: ['4']
          },
          {
            id: '4'
          },
          {
            id: '2'
          }
        ],
        minRating: 5,
        readBooks: [
          { bookID: '1', rating: 5 },
          { bookID: '3', rating: 4 }
        ]
      });

      assert.deepEqual(books, [
        { bookID: '2', count: 1, percentile: 100 }
      ]);
    });

    it('can restrict recommendations to a subset of books', async function() {
      const books = await getRecommendedBooks({
        books: [
          {
            id: '1',
            similarBooks: ['2']
          },
          {
            id: '3',
            similarBooks: ['4']
          },
          {
            id: '4'
          },
          {
            id: '2'
          }
        ],
        coreBookIDs: ['1'],
        readBooks: [
          { bookID: '1', rating: 5 },
          { bookID: '3', rating: 5 }
        ]
      });

      assert.deepEqual(books, [
        { bookID: '2', count: 1, percentile: 100 }
      ]);
    });

    it('can restrict recommendations by percentile', async function() {
      const books = await getRecommendedBooks({
        books: [
          {
            id: '1',
            similarBooks: ['2', '4']
          },
          {
            id: '3',
            similarBooks: ['4']
          },
          {
            id: '4'
          },
          {
            id: '2'
          }
        ],
        percentile: 100,
        readBooks: [
          { bookID: '1', rating: 5 },
          { bookID: '3', rating: 5 }
        ]
      });

      assert.deepEqual(books, [
        { bookID: '4', count: 2, percentile: 100 }
      ]);
    });

    it('can restrict recommendations by shelf', async function() {
      const books = await getRecommendedBooks({
        books: [
          {
            id: '1',
            shelves: [
              { count: 2, name: 'alfa' },
              { count: 1, name: 'bravo' }
            ],
            similarBooks: ['2']
          },
          {
            id: '3',
            shelves: [
              { count: 2, name: 'bravo' },
              { count: 1, name: 'alfa' }
            ],
            similarBooks: ['4']
          },
          {
            id: '4'
          },
          {
            id: '2'
          }
        ],
        readBooks: [
          { bookID: '1', rating: 5 },
          { bookID: '3', rating: 5 }
        ],
        shelfPercentile: 100,
        shelves: ['alfa']
      });

      assert.deepEqual(books, [
        { bookID: '2', count: 1, percentile: 100 }
      ]);
    });

  });

  describe('summarizeRecommendedBooks', function() {

    function getSummaryLines(books: PartitionedRecommendation[], genrePercentile: number): string[] {
      stub(goodreads, 'getViewBookURL', function(id) {
        return `view-${id}`;
      });

      return summarizeRecommendedBooks(books, genrePercentile).split('\n');
    }

    it('summarizes a list of recommended books', function() {
      const summary = getSummaryLines([
        {
          data: {
            book: createBook({
              author: {
                id: '3',
                name: 'Charlie'
              },
              averageRating: undefined,
              id: '1',
              shelves: [
                { count: 2, name: 'bravo' },
                { count: 3, name: 'delta' },
                { count: 1, name: 'alfa' }
              ],
              title: 'Alfa'
            }),
            recommendations: 2
          },
          percentile: 100
        },
        {
          data: {
            book: createBook({
              author: {
                id: '4',
                name: 'Delta'
              },
              averageRating: 2.875,
              id: '2',
              shelves: [
                { count: 1, name: 'charlie' }
              ],
              title: 'Bravo'
            }),
            recommendations: 1
          },
          percentile: 50
        }
      ], 50);

      assert.deepEqual(summary, [
        'Alfa | p100',
        '===========',
        '',
        'Author: Charlie',
        'Shelves: bravo, delta',
        '',
        '[View on Goodreads](view-1)',
        '',
        '',
        'Bravo | p50',
        '===========',
        '',
        'Author: Delta',
        'Shelves: charlie',
        'Average Rating: 2.88',
        '',
        '[View on Goodreads](view-2)'
      ]);
    });

  });

});
