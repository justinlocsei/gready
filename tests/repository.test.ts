import { isEqual } from 'lodash';

import * as API from '../src/types/api';
import * as Core from '../src/types/core';
import * as F from './helpers/factories';
import * as reviews from '../src/reviews';
import APIClient from '../src/api-client';
import assert from './helpers/assert';
import Cache from '../src/cache';
import Repository from '../src/repository';
import { BookID } from '../src/types/goodreads';
import { configureNetworkAccess } from './helpers/requests';
import { createTestCache, createTestConfig, createTestLogger } from './helpers';
import { replaceMethod } from './helpers/mocking';
import { UserConfiguration } from '../src/types/config';

describe('repository', function() {

  describe('Repository', function() {

    configureNetworkAccess(this, {
      allowRequests: false,
      timeout: this.timeout(),
      useFixtures: false
    });

    function createClient(): APIClient {
      return new APIClient({
        apiKey: 'testing',
        cache: createTestCache(),
        logger: createTestLogger()[0]
      });
    }

    function createRepo(client: APIClient, options: {
      cache?: Cache;
      config?: UserConfiguration;
    } = {}): Repository {
      return new Repository({
        apiClient: client,
        cache: options.cache || createTestCache(),
        config: createTestConfig(options.config),
        logger: createTestLogger()[0]
      });
    }

    describe('.getBook', function() {

      function getBook(
        query: Partial<API.Book>,
        canonical?: Partial<API.Book>,
        config?: UserConfiguration
      ): Promise<Core.Book> {
        const client = createClient();
        const repo = createRepo(client, { config });

        const book = F.createAPIBook(query);
        const canonicalBook = canonical ? F.createAPIBook(canonical) : book;

        replaceMethod(client, 'getBook', function(id) {
          switch (id) {
            case book.id:
              return Promise.resolve(book);
            case canonicalBook.id:
              return Promise.resolve(canonicalBook);
            default:
              throw new Error(`Unexpected book ID: ${id}`);
          }
        });

        replaceMethod(client, 'getCanonicalBookID', function(sourceBook) {
          if (sourceBook.id === book.id) {
            return Promise.resolve(canonicalBook.id);
          } else {
            throw new Error(`Received unexpected source book when checking for a canonical ID: ${sourceBook.id}`);
          }
        });

        return repo.getBook(book.id);
      }

      it('gets information on a book using its ID', async function() {
        const book = await getBook({
          id: '1',
          publisher: 'Book Publisher',
          title: 'Book Title'
        });

        assert.equal(book.id, '1');
        assert.equal(book.publisher, 'Book Publisher');
        assert.equal(book.title, 'Book Title');
      });

      it('uses the work’s original title when the book lacks a title', async function() {
        const book = await getBook({
          title: '',
          work: F.createAPIWork({ title: 'Work Title' })
        });

        assert.equal(book.title, 'Work Title');
      });

      it('removes excess whitespace from the book’s title', async function() {
        const book = await getBook({
          title: '  Book  Title  '
        });

        assert.equal(book.title, 'Book Title');
      });

      it('removes excess whitespace from the book’s publisher', async function() {
        const book = await getBook({
          publisher: '  Book  Publisher  '
        });

        assert.equal(book.publisher, 'Book Publisher');
      });

      it('uses the first available author', async function() {
        const oneAuthor = await getBook({
          authors: {
            author: { id: '1', name: 'Alfa' }
          }
        });

        const twoAuthors = await getBook({
          authors: {
            author: [
              { id: '1', name: 'Alfa' },
              { id: '2', name: 'Bravo' }
            ]
          }
        });

        assert.equal(oneAuthor.author.name, 'Alfa');
        assert.equal(twoAuthors.author.name, 'Alfa');
      });

      it('populates a list of the book’s shelves', async function() {
        const oneShelf = await getBook({
          popular_shelves: {
            shelf: {
              $: { count: '1', name: 'alfa' }
            }
          }
        });

        const twoShelves = await getBook({
          popular_shelves: {
            shelf: [
              { $: { count: '1', name: 'alfa' } },
              { $: { count: '2', name: 'bravo' } }
            ]
          }
        });

        assert.deepEqual(oneShelf.shelves, [
          { count: 1, name: 'alfa' }
        ]);

        assert.deepEqual(twoShelves.shelves, [
          { count: 2, name: 'bravo' },
          { count: 1, name: 'alfa' }
        ]);
      });

      it('removes excess whitespace from the names of a book’s shelves', async function() {
        const scalar = await getBook({
          popular_shelves: {
            shelf: {
              $: { count: '1', name: '  alfa  ' }
            }
          }
        });

        const array = await getBook({
          popular_shelves: {
            shelf: [
              { $: { count: '1', name: '  bravo  ' } }
            ]
          }
        });

        assert.deepEqual(scalar.shelves, [
          { count: 1, name: 'alfa' }
        ]);

        assert.deepEqual(array.shelves, [
          { count: 1, name: 'bravo' }
        ]);
      });

      it('exposes the IDs of a book’s similar books', async function() {
        const oneBook = await getBook({
          similar_books: {
            book: { id: '1' }
          }
        });

        const twoBooks = await getBook({
          similar_books: {
            book: [
              { id: '1' },
              { id: '2' }
            ]
          }
        });

        assert.deepEqual(oneBook.similarBooks, ['1']);
        assert.deepEqual(twoBooks.similarBooks, ['1', '2']);
      });

      it('exposes rating metrics for the book', async function() {
        const book = await getBook({
          work: F.createAPIWork({
            ratingsCount: '10',
            ratingsSum: '20'
          })
        });

        assert.equal(book.averageRating, 2);
        assert.equal(book.totalRatings, 10);
      });

      it('handles books without any ratings', async function() {
        const book = await getBook({
          work: F.createAPIWork({
            ratingsCount: '0',
            ratingsSum: '0'
          })
        });

        assert.isUndefined(book.averageRating);
        assert.equal(book.totalRatings, 0);
      });

      it('extracts the ID of the book to use for reviews from its reviews widget', async function() {
        replaceMethod(reviews, 'extractReviewsIDFromWidget', function(embedCode) {
          if (embedCode === 'alfa') {
            return 'bravo';
          } else {
            throw new Error(`Unexpected embed code: ${embedCode}`);
          }
        });

        const book = await getBook({
          reviews_widget: 'alfa'
        });

        assert.equal(book.reviewsID, 'bravo');
      });

      it('uses the book’s ID as its reviews ID when its reviews widget does not contain an ID', async function() {
        replaceMethod(reviews, 'extractReviewsIDFromWidget', e => null);

        const book = await getBook({
          id: '10'
        });

        assert.equal(book.reviewsID, '10');
      });

      it('treats books without a publisher as self-published works', async function() {
        const book = await getBook({
          authors: {
            author: {
              id: '1',
              name: 'Author'
            }
          },
          publisher: ''
        });

        assert.equal(book.publisher, 'Author');
      });

      it('uses a book’s ID as its canonical ID by default', async function() {
        const book = await getBook({
          id: '1'
        });

        assert.equal(book.canonicalID, '1');
      });

      it('can get a book’s canonical ID', async function() {
        const book = await getBook(
          { id: '1' },
          { id: '2' }
        );

        assert.equal(book.canonicalID, '2');
      });

      it('uses the publisher of the canonical book if the original book lacks a publisher', async function() {
        const book = await getBook(
          { id: '1', publisher: '' },
          { id: '2', publisher: 'Publisher' }
        );

        assert.equal(book.publisher, 'Publisher');
      });

      it('filters out the default Goodreads shelves', async function() {
        const book = await getBook({
          popular_shelves: {
            shelf: [
              { $: { count: '20', name: 'currently-reading' } },
              { $: { count: '10', name: 'to-read' } },
              { $: { count: '1', name: 'shelf' } }
            ]
          }
        });

        assert.deepEqual(book.shelves, [
          { count: 1, name: 'shelf' }
        ]);
      });

      it('removes any shelves on the configurable blacklist', async function() {
        const book = await getBook(
          {
            popular_shelves: {
              shelf: [
                { $: { count: '20', name: 'currently-reading' } },
                { $: { count: '10', name: 'to-read' } },
                { $: { count: '3', name: 'alfa' } },
                { $: { count: '2', name: 'bravo' } },
                { $: { count: '1', name: 'charlie' } }
              ]
            }
          },
          {},
          {
            ignoreShelves: ['alfa', 'charlie']
          }
        );

        assert.deepEqual(book.shelves, [
          { count: 2, name: 'bravo' }
        ]);
      });

      it('merges shelves specified in the configuration', async function() {
        const book = await getBook(
          {
            popular_shelves: {
              shelf: [
                { $: { count: '20', name: 'currently-reading' } },
                { $: { count: '10', name: 'to-read' } },
                { $: { count: '4', name: 'alfa' } },
                { $: { count: '3', name: 'bravo' } },
                { $: { count: '2', name: 'charlie' } },
                { $: { count: '1', name: 'delta' } }
              ]
            }
          },
          {},
          {
            mergeShelves: {
              alfa: ['bravo', 'charlie']
            }
          }
        );

        assert.deepEqual(book.shelves, [
          { count: 9, name: 'alfa' },
          { count: 1, name: 'delta' }
        ]);
      });

      it('merges publishers specified in the configuration', async function() {
        const config: UserConfiguration = {
          mergePublishers: {
            alfa: ['bravo']
          }
        };

        const alfa = await getBook({ publisher: 'alfa' }, {}, config);
        const bravo = await getBook({ publisher: 'bravo' }, {}, config);
        const charlie = await getBook({ publisher: 'charlie' }, {}, config);

        assert.equal(alfa.publisher, 'alfa');
        assert.equal(bravo.publisher, 'alfa');
        assert.equal(charlie.publisher, 'charlie');
      });

    });

    describe('.getLocalBooks', function() {

      function getLocalBooks(
        availableBooks: Partial<Core.Book>[],
        bookIDs: BookID[],
        config?: UserConfiguration
      ): Promise<Core.Book[]> {
        const client = createClient();
        const cache = createTestCache();
        const repo = createRepo(client, { cache, config });

        const books = availableBooks.map(F.createBook);

        replaceMethod(cache, 'entries', function(namespace) {
          if (isEqual(namespace, ['books'])) {
            return Promise.resolve(books);
          } else {
            throw new Error(`Unexpected cache namespace: ${namespace.join('.')}`);
          }
        });

        return repo.getLocalBooks(bookIDs);
      }

      it('gets the books in a list that are available in the cache', async function() {
        const books = await getLocalBooks(
          [{ id: '1' }, { id: '2' }],
          ['1', '3']
        );

        assert.deepEqual(books.map(b => b.id), ['1']);
      });

      it('applies sanitization based on the configuration to each book', async function() {
        const book = F.createBook({
          publisher: 'bravo',
          shelves: [
            { count: 1, name: 'alfa' },
            { count: 2, name: 'bravo' },
            { count: 3, name: 'charlie' },
            { count: 4, name: 'delta' }
          ]
        });

        const noConfig = await getLocalBooks([book], [book.id]);

        const withConfig = await getLocalBooks([book], [book.id], {
          ignoreShelves: ['charlie'],
          mergePublishers: { alfa: ['bravo'] },
          mergeShelves: { alfa: ['bravo'] }
        });

        assert.equal(noConfig.length, 1);
        assert.equal(withConfig.length, 1);

        const normal = noConfig[0];
        const sanitized = withConfig[0];

        assert.equal(normal.publisher, 'bravo');
        assert.equal(sanitized.publisher, 'alfa');

        assert.equal(normal.shelves.length, 4);

        assert.deepEqual(sanitized.shelves, [
          { count: 4, name: 'delta' },
          { count: 3, name: 'alfa' }
        ]);
      });

      it('sorts the books by title and ID', async function() {
        const books = await getLocalBooks(
          [
            { id: '2', title: 'bravo' },
            { id: '1', title: 'alfa' },
            { id: '3', title: 'bravo' }
          ],
          ['1', '2', '3']
        );

        assert.deepEqual(
          books.map(b => b.id),
          ['1', '2', '3']
        );
      });

      it('returns an empty list when the cache is empty', async function() {
        assert.isEmpty(await getLocalBooks([], ['1']));
      });

      it('returns an empty list when no books in the list are locally available', async function() {
        assert.isEmpty(await getLocalBooks([F.createBook({ id: '1' })], ['2']));
      });

      it('returns an empty list when no books are specified', async function() {
        assert.isEmpty(await getLocalBooks([F.createBook()], []));
      });

    });

    describe('.getReadBooks', function() {

      function getReadBooks(books: Partial<API.ReadBook>[], userID = '1'): Promise<Core.ReadBook[]> {
        const client = createClient();
        const repo = createRepo(client);

        replaceMethod(client, 'getReadBooks', function(id) {
          if (id === userID) {
            return Promise.resolve(books.map(F.createAPIReadBook));
          } else {
            throw new Error(`Unexpected user ID: ${id}`);
          }
        });

        return repo.getReadBooks(userID);
      }

      it('returns a user’s read books', async function() {
        const books = await getReadBooks([
          { id: '1' },
          { id: '2' }
        ]);

        assert.deepEqual(
          books.map(b => b.id),
          ['1', '2']
        );
      });

      it('returns information on each read book', async function() {
        const books = await getReadBooks([{
          book: {
            id: { _: '2' },
            publisher: 'Publisher',
            work: { id: '3' }
          },
          id: '1'
        }]);

        assert.equal(books.length, 1);
        const book = books[0];

        assert.equal(book.id, '1');
        assert.equal(book.bookID, '2');
      });

      it('falls back to the date added if no read-at date is present', async function() {
        const dayOne = 'Mon Dec 30 12:00:00 -0500 2019';
        const dayTwo = 'Tue Dec 31 12:00:00 -0500 2019';

        const [read] = await getReadBooks([{ date_added: dayOne, read_at: dayTwo }]);
        const [added] = await getReadBooks([{ date_added: dayOne, read_at: '' }]);

        assert.equal(
          new Date(read.posted).toISOString(),
          '2019-12-31T17:00:00.000Z'
        );

        assert.equal(
          new Date(added.posted).toISOString(),
          '2019-12-30T17:00:00.000Z'
        );
      });

      it('exposes a rating if one is given', async function() {
        const [rated] = await getReadBooks([{ rating: '1' }]);
        const [unrated] = await getReadBooks([{ rating: '' }]);

        assert.equal(rated.rating, 1);
        assert.isUndefined(unrated.rating);
      });

      it('handles one or more shelves', async function() {
        const [oneShelf] = await getReadBooks([{
          shelves: {
            shelf: {
              $: { name: 'alfa' }
            }
          }
        }]);

        const [twoShelves] = await getReadBooks([{
          shelves: {
            shelf: [
              { $: { name: 'alfa' } },
              { $: { name: 'bravo' } }
            ]
          }
        }]);

        assert.deepEqual(oneShelf.shelves, ['alfa']);
        assert.deepEqual(twoShelves.shelves, ['alfa', 'bravo']);
      });

      it('sorts books by their posted date and ID', async function() {
        const books = await getReadBooks([
          { id: '2', read_at: 'Mon Dec 30 12:00:00 -0500 2019' },
          { id: '1', read_at: 'Tue Dec 31 12:00:00 -0500 2019' },
          { id: '3', read_at: 'Mon Dec 30 12:00:00 -0500 2019' }
        ]);

        assert.deepEqual(
          books.map(b => b.id),
          ['1', '2', '3']
        );
      });

    });

    describe('.getSimilarReviews', function() {

      function getSimilarReviews(reviews: Partial<API.Review>[]): Promise<Core.Review[]> {
        const client = createClient();
        const repo = createRepo(client);

        const book = F.createBook({ id: '1', reviewsID: '2' });
        const readBook = F.createReadBook({ id: '3', rating: 5 });

        replaceMethod(client, 'getBookReviews', function(id, options) {
          assert.equal(options.limit, reviews.length);
          assert.equal(options.rating, 5);

          if (id === book.reviewsID) {
            return Promise.resolve(reviews.map(F.createAPIReview));
          } else {
            throw new Error(`Unexpected book ID: ${id}`);
          }
        });

        return repo.getSimilarReviews(book, readBook, reviews.length);
      }

      it('returns similar reviews of a book', async function() {
        const reviews = await getSimilarReviews([
          { id: '1' },
          { id: '2' }
        ]);

        assert.deepEqual(
          reviews.map(r => r.id),
          ['1', '2']
        );
      });

      it('applies the same normalization for read books to each review', async function() {
        const added = 'Mon Dec 30 12:00:00 -0500 2019';
        const read = 'Tue Dec 31 12:00:00 -0500 2019';

        const [review] = await getSimilarReviews([{
          book: {
            id: { _: '1' },
            publisher: 'Publisher',
            work: { id: '2' }
          },
          date_added: added,
          read_at: read,
          id: '3',
          rating: '5',
          shelves: {
            shelf: [
              { $: { name: 'alfa' } },
              { $: { name: 'bravo' } }
            ]
          }
        }]);

        assert.equal(review.bookID, '1');
        assert.equal(review.id, '3');
        assert.equal(review.posted, new Date(read).getTime());
        assert.equal(review.rating, 5);
        assert.deepEqual(review.shelves, ['alfa', 'bravo']);
      });

      it('exposes normalized user data for each review', async function() {
        const [review] = await getSimilarReviews([{
          user: {
            id: '1',
            link: 'link',
            name: '  User  Name  '
          }
        }]);

        assert.deepEqual(review.user, {
          id: '1',
          name: 'User Name',
          profileURL: 'link'
        });
      });

    });

  });

});
