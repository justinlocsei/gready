import * as goodreads from '../../src/goodreads';
import assert from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';
import { Book, ReadBook, Review } from '../../src/types/core';
import { BookID } from '../../src/types/goodreads';
import { createBook, createReadBook, createReview, createUser } from '../helpers/factories';
import { createTestRepo } from '../helpers';
import { findSimilarReaders, summarizeSimilarReaders } from '../../src/search/readers';

describe('search/readers', function() {

  const { stub } = allowOverrides(this);

  describe('findSimilarReaders', function() {

    async function getSimilarReaders({
      books,
      maxReviews = 1,
      readBooks,
      reviews,
      shelfPercentile = 0
    }: {
      books: Partial<Book>[];
      maxReviews?: number;
      readBooks: Partial<ReadBook>[];
      reviews: Record<BookID, Partial<Review>[]>;
      shelfPercentile?: number;
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

      stub(repo, 'getSimilarReviews', function(book, readBook, limit) {
        assert.equal(limit, maxReviews, 'the review limit was not forwarded');
        assert.equal(book.id, readBook.bookID, 'the book and its review’s book ID were out of sync');

        return Promise.resolve((reviews[book.id] || []).map(createReview));
      });

      stub(goodreads, 'getUserBooksURL', function(id) {
        return `books-${id}`;
      });

      const readers = await findSimilarReaders({
        maxReviews,
        readBooks: readBooks.map(createReadBook),
        repo,
        shelfPercentile
      });

      return readers.map(function({ books, shelves, user }) {
        assert.equal(user.booksURL, `books-${user.id}`, 'the user’s view-books URL was incorrect');

        return {
          bookIDs: books.map(b => b.id),
          shelves,
          userID: user.id
        };
      });
    }

    it('finds recommendations in a set of books', async function() {
      const userFour = createUser({ id: '4' });
      const userFive = createUser({ id: '5' });
      const userSix = createUser({ id: '6' });

      const readers = await getSimilarReaders({
        books: [
          { id: '1', title: 'Alfa' },
          { id: '2', title: 'Bravo' },
          { id: '3', title: 'Bravo' }
        ],
        maxReviews: 2,
        readBooks: [
          { bookID: '3' },
          { bookID: '1' },
          { bookID: '2' }
        ],
        reviews: {
          '1': [
            { user: userFour },
            { user: userFive }
          ],
          '2': [
            { user: userFour },
            { user: userSix }
          ],
          '3': [
            { user: userFive }
          ]
        }
      });

      assert.deepEqual(readers, [
        {
          bookIDs: ['1', '2'],
          shelves: [],
          userID: '4'
        },
        {
          bookIDs: ['1', '3'],
          shelves: [],
          userID: '5'
        },
        {
          bookIDs: ['2'],
          shelves: [],
          userID: '6'
        }
      ]);
    });

    it('excludes unrated books', async function() {
      const readers = await getSimilarReaders({
        books: [
          { id: '1' },
          { id: '2' }
        ],
        readBooks: [
          { bookID: '1', rating: 5 },
          { bookID: '2', rating: undefined }
        ],
        reviews: {
          '1': [{ user: createUser({ id: '3' }) }],
          '2': [{ user: createUser({ id: '4' }) }]
        }
      });

      assert.deepEqual(readers, [
        {
          bookIDs: ['1'],
          shelves: [],
          userID: '3'
        }
      ]);
    });

    it('exposes metrics on a user’s shelves', async function() {
      const userThree = createUser({ id: '3' });
      const userFour = createUser({ id: '4' });

      const readers = await getSimilarReaders({
        books: [
          {
            id: '1',
            shelves: [
              { count: 2, name: 'alfa' },
              { count: 1, name: 'bravo' }
            ]
          },
          {
            id: '2',
            shelves: [
              { count: 2, name: 'charlie' },
              { count: 1, name: 'alfa' }
            ]
          }
        ],
        maxReviews: 2,
        readBooks: [
          { bookID: '1' },
          { bookID: '2' }
        ],
        reviews: {
          '1': [
            { user: userThree },
            { user: userFour }
          ],
          '2': [
            { user: userThree }
          ]
        }
      });

      assert.deepEqual(readers, [
        {
          bookIDs: ['1', '2'],
          shelves: [
            { count: 2, name: 'alfa' },
            { count: 1, name: 'bravo' },
            { count: 1, name: 'charlie' }
          ],
          userID: '3'
        },
        {
          bookIDs: ['1'],
          shelves: [
            { count: 1, name: 'alfa' },
            { count: 1, name: 'bravo' }
          ],
          userID: '4'
        }
      ]);
    });

    it('can restrict shelf metrics by percentile', async function() {
      const userThree = createUser({ id: '3' });
      const userFour = createUser({ id: '4' });

      const readers = await getSimilarReaders({
        books: [
          {
            id: '1',
            shelves: [
              { count: 2, name: 'alfa' },
              { count: 1, name: 'bravo' }
            ]
          },
          {
            id: '2',
            shelves: [
              { count: 2, name: 'charlie' },
              { count: 1, name: 'alfa' }
            ]
          }
        ],
        maxReviews: 2,
        readBooks: [
          { bookID: '1' },
          { bookID: '2' }
        ],
        reviews: {
          '1': [
            { user: userThree },
            { user: userFour }
          ],
          '2': [
            { user: userThree }
          ]
        },
        shelfPercentile: 100
      });

      assert.deepEqual(readers, [
        {
          bookIDs: ['1', '2'],
          shelves: [
            { count: 1, name: 'alfa' }
          ],
          userID: '3'
        },
        {
          bookIDs: ['1'],
          shelves: [
            { count: 1, name: 'alfa' }
          ],
          userID: '4'
        }
      ]);

    });

  });

  describe('summarizeSimilarReaders', function() {

    it('summarizes a list of recommended books', function() {
      const summary = summarizeSimilarReaders([
        {
          books: [
            createBook({ title: 'Bravo' }),
            createBook({ title: 'Alfa' })
          ],
          shelves: [
            { count: 2, name: 'alfa' },
            { count: 1, name: 'bravo' }
          ],
          user: {
            booksURL: 'books/1',
            id: '1',
            name: 'Charlie',
            profileURL: 'profile/1'
          }
        },
        {
          books: [
            createBook({ title: 'Alfa' })
          ],
          shelves: [],
          user: {
            booksURL: 'books/2',
            id: '2',
            name: 'Delta',
            profileURL: 'profile/2'
          }
        }
      ]);

      assert.deepEqual(summary.split('\n'), [
        'Charlie',
        '=======',
        '',
        '[Profile](profile/1)',
        '[Books](books/1)',
        '',
        'Shared Books: 2',
        '---------------',
        '',
        '* Bravo',
        '* Alfa',
        '',
        'Shared Shelves',
        '--------------',
        '',
        '* alfa: 2',
        '* bravo: 1',
        '',
        '',
        'Delta',
        '=====',
        '',
        '[Profile](profile/2)',
        '[Books](books/2)',
        '',
        'Shared Books: 1',
        '---------------',
        '',
        '* Alfa'
      ]);
    });

  });

});
