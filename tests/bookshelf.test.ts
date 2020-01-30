import assert from './helpers/assert';
import { Book } from '../src/types/core';
import { Bookshelf } from '../src/bookshelf';
import { createBookshelf } from './helpers/factories';

describe('bookshelf', function() {

  describe('Bookshelf', function() {

    describe('.getBooks', function() {

      it('returns an empty list when no books are present', function() {
        assert.isEmpty(createBookshelf().getBooks());
      });

      it('returns all books in the shelf', function() {
        const bookshelf = createBookshelf([
          { title: 'alfa', id: '2' },
          { title: 'bravo', id: '3' },
          { title: 'alfa', id: '1' }
        ]);

        const books = bookshelf
          .getBooks()
          .map(({ id, title }) => ({ id, title }));

        assert.deepEqual(books, [
          { title: 'alfa', id: '1' },
          { title: 'alfa', id: '2' },
          { title: 'bravo', id: '3' }
        ]);
      });

    });

    describe('.getBooksInShelves', function() {

      it('returns all books in a set of shelves at the given percentile', function() {
        const books: Partial<Book>[] = [
          {
            title: 'Bravo',
            shelves: [
              { count: 2, name: 'alfa' },
              { count: 1, name: 'bravo' }
            ]
          },
          {
            title: 'Alfa',
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 2, name: 'bravo' }
            ]
          },
          {
            title: 'Charlie',
            shelves: [
              { count: 1, name: 'charlie' }
            ]
          }
        ];

        const low = createBookshelf(books, 0);
        const high = createBookshelf(books, 100);

        const lowAlfa = low.getBooksInShelves('alfa').map(b => b.title);
        const highAlfa = high.getBooksInShelves('alfa').map(b => b.title);

        const lowBravo = low.getBooksInShelves('bravo').map(b => b.title);
        const highBravo = high.getBooksInShelves('bravo').map(b => b.title);

        assert.deepEqual(lowAlfa, ['Alfa', 'Bravo']);
        assert.deepEqual(highAlfa, ['Bravo']);

        assert.deepEqual(lowBravo, ['Alfa', 'Bravo']);
        assert.deepEqual(highBravo, ['Alfa']);
      });

      it('includes books from multiple shelves', function() {
        const bookshelf = createBookshelf([
          {
            title: 'Bravo',
            shelves: [
              { count: 1, name: 'alfa' }
            ]
          },
          {
            title: 'Alfa',
            shelves: [
              { count: 1, name: 'bravo' }
            ]
          },
          {
            title: 'Charlie',
            shelves: [
              { count: 1, name: 'charlie' }
            ]
          }
        ]);

        assert.deepEqual(
          bookshelf.getBooksInShelves('alfa', 'charlie').map(b => b.title),
          ['Bravo', 'Charlie']
        );

        assert.deepEqual(
          bookshelf.getBooksInShelves('alfa', 'bravo').map(b => b.title),
          ['Alfa', 'Bravo']
        );
      });

      it('returns an empty list when no shelves are specified', function() {
        const bookshelf = createBookshelf([
          {
            shelves: [
              { count: 1, name: 'alfa' }
            ]
          }
        ]);

        assert.isEmpty(bookshelf.getBooksInShelves());
      });

      it('returns an empty list when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().getBooksInShelves());
      });

    });

    describe('.getAllShelves', function() {

      it('provides a partitioned view of all shelves', function() {
        const books: Partial<Book>[] = [
          {
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 2, name: 'bravo' }
            ]
          },
          {
            shelves: [
              { count: 3, name: 'alfa' },
              { count: 1, name: 'charlie' }
            ]
          }
        ];

        const low = createBookshelf(books, 0);
        const high = createBookshelf(books, 100);

        assert.deepEqual(low.getAllShelves(), [
          { data: { count: 4, name: 'alfa' }, percentile: 100 },
          { data: { count: 2, name: 'bravo' }, percentile: 67 },
          { data: { count: 1, name: 'charlie' }, percentile: 33 }
        ]);

        assert.deepEqual(
          low.getAllShelves(),
          high.getAllShelves()
        );
      });

      it('returns an empty list when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().getAllShelves());
      });

    });

    describe('.getShelves', function() {

      it('lists only shelves that appear at or above the given percentile', function() {
        const books: Partial<Book>[] = [
          {
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 2, name: 'bravo' }
            ]
          },
          {
            shelves: [
              { count: 3, name: 'alfa' },
              { count: 1, name: 'charlie' }
            ]
          }
        ];

        const low = createBookshelf(books, 50);
        const high = createBookshelf(books, 100);

        assert.deepEqual(low.getShelves(), [
          { data: { count: 4, name: 'alfa' }, percentile: 100 },
          { data: { count: 2, name: 'bravo' }, percentile: 67 }
        ]);

        assert.deepEqual(high.getShelves(), [
          { data: { count: 4, name: 'alfa' }, percentile: 100 }
        ]);
      });

      it('returns an empty list when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().getShelves());
      });

    });

    describe('.groupByAuthor', function() {

      it('groups books by author', function() {
        const bookshelf = createBookshelf([
          {
            author: { id: '1', name: 'Alfa Bravo' },
            id: '2',
            title: 'alfa'
          },
          {
            author: { id: '1', name: 'Alfa Bravo' },
            id: '1',
            title: 'alfa'
          },
          {
            author: { id: '2', name: 'Bravo Alfa' },
            id: '3',
            title: 'bravo'
          }
        ]);

        const grouped = bookshelf.groupByAuthor().map(function(group) {
          return {
            authorID: group.author.id,
            bookIDs: group.books.map(b => b.id)
          };
        });

        assert.deepEqual(grouped, [
          { authorID: '2', bookIDs: ['3'] },
          { authorID: '1', bookIDs: ['1', '2'] }
        ]);
      });

      it('returns an empty list when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().groupByAuthor());
      });

    });

    describe('.groupByPublisher', function() {

      it('groups books by publisher', function() {
        const bookshelf = createBookshelf([
          {
            id: '2',
            publisher: 'Alfa',
            title: 'alfa'
          },
          {
            id: '1',
            publisher: 'Alfa',
            title: 'alfa'
          },
          {
            id: '3',
            publisher: 'Bravo',
            title: 'bravo'
          }
        ]);

        const grouped = bookshelf.groupByPublisher().map(function(group) {
          return {
            publisher: group.publisherName,
            bookIDs: group.books.map(b => b.id)
          };
        });

        assert.deepEqual(grouped, [
          { publisher: 'Alfa', bookIDs: ['1', '2'] },
          { publisher: 'Bravo', bookIDs: ['3'] }
        ]);
      });

      it('returns an empty list when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().groupByPublisher());
      });

    });

    describe('.groupByShelf', function() {

      function getShelfGroup(bookshelf: Bookshelf) {
        return bookshelf.groupByShelf().map(function({ books, percentile, shelfName, totalCount }) {
          return {
            books: books.map(b => ({ id: b.book.id, percentile: b.percentile })),
            percentile,
            shelfName,
            totalCount
          };
        });
      }

      it('groups books by shelf', function() {
        const books: Partial<Book>[] = [
          {
            id: '2',
            shelves: [
              { count: 2, name: 'alfa' },
              { count: 1, name: 'bravo' }
            ],
            title: 'Alfa'
          },
          {
            id: '1',
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 2, name: 'bravo' }
            ],
            title: 'Alfa'
          },
          {
            id: '3',
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 1, name: 'charlie' }
            ],
            title: 'Bravo'
          }
        ];

        const low = createBookshelf(books, 0);
        const high = createBookshelf(books, 100);

        assert.deepEqual(getShelfGroup(low), [
          {
            books: [
              { id: '2', percentile: 100 },
              { id: '3', percentile: 100 },
              { id: '1', percentile: 50 }
            ],
            percentile: 100,
            shelfName: 'alfa',
            totalCount: 4
          },
          {
            books: [
              { id: '1', percentile: 100 },
              { id: '2', percentile: 50 }
            ],
            percentile: 67,
            shelfName: 'bravo',
            totalCount: 3
          },
          {
            books: [
              { id: '3', percentile: 100 }
            ],
            percentile: 33,
            shelfName: 'charlie',
            totalCount: 1
          }
        ]);

        assert.deepEqual(getShelfGroup(high), [
          {
            books: [
              { id: '2', percentile: 100 },
              { id: '3', percentile: 100 }
            ],
            percentile: 100,
            shelfName: 'alfa',
            totalCount: 3
          }
        ]);
      });

      it('returns an empty list when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().groupByShelf());
      });

    });

    describe('.restrictShelves', function() {

      it('creates a new bookshelf that excludes books that do not appear in the list of shelves', function() {
        const bookshelf = createBookshelf([
          {
            id: '2',
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 3, name: 'bravo' }
            ],
            title: 'Bravo'
          },
          {
            id: '1',
            shelves: [
              { count: 1, name: 'alfa' },
              { count: 2, name: 'charlie' }
            ],
            title: 'Alfa'
          },
          {
            id: '3',
            shelves: [
              { count: 2, name: 'alfa' },
              { count: 1, name: 'bravo' }
            ],
            title: 'Charlie'
          }
        ], 100);

        const restricted = bookshelf.restrictShelves('bravo', 'charlie');

        assert.deepEqual(
          restricted.getBooks().map(b => b.id),
          ['1', '2']
        );

        assert.deepEqual(
          restricted.getShelves().map(s => s.data.name),
          ['bravo']
        );
      });

      it('returns an empty bookshelf when no shelves are given', function() {
        const bookshelf = createBookshelf([{
          shelves: [{ count: 1, name: 'alfa' }],
          title: 'Alfa'
        }]);

        assert.isEmpty(bookshelf.restrictShelves().getBooks());
      });

      it('returns an empty bookshelf when no books are in the shelf', function() {
        assert.isEmpty(createBookshelf().restrictShelves().getBooks());
      });

    });

  });

});
