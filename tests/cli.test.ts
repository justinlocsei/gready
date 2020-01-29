import { range } from 'lodash';

import * as booksSearch from '../src/search/books';
import * as Core from '../src/types/core';
import * as readersSearch from '../src/search/readers';
import * as summary from '../src/summary';
import assert from './helpers/assert';
import Logger from '../src/logger';
import { allowOverrides } from './helpers/mocking';
import { BookID, UserID } from '../src/types/goodreads';
import { createBook, createReadBook, createUser } from './helpers/factories';
import { createCLI, CLI } from '../src/cli';
import { createOutputHandler, createTestLogger, createTestRepo, OutputReader } from './helpers';
import { OutputHandler } from '../src/types/system';

describe('cli', function() {

  const { stub } = allowOverrides(this);

  describe('CLI', function() {

    function createTestCLI({
      logger,
      userID = '1',
      writeOutput
    }: {
      logger?: Logger;
      userID?: UserID;
      writeOutput?: OutputHandler;
    } = {}): [CLI, OutputReader] {
      const [handleOutput, readOutput] = createOutputHandler();

      const cli = new CLI({
        logger: logger || createTestLogger()[0],
        repo: createTestRepo(),
        userID,
        writeOutput: handleOutput
      });

      return [cli, readOutput];
    }

    describe('.findBooks', function() {

      it('finds and summarizes recommended books', async function() {
        const [cli, readOutput] = createTestCLI({ userID: '1', });

        const readBooks: Core.ReadBook[] = [];
        const recommendations: booksSearch.PartitionedRecommendation[] = [];

        stub(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');
          return Promise.resolve(readBooks);
        });

        stub(booksSearch, 'findRecommendedBooks', function(options) {
          assert.deepEqual(options, {
            coreBookIDs: ['2'],
            minRating: 3,
            percentile: 4,
            readBooks,
            repo: cli.repo,
            shelfPercentile: 5,
            shelves: ['alfa']
          });

          return Promise.resolve(recommendations);
        });

        stub(booksSearch, 'summarizeRecommendedBooks', function(recs) {
          assert.equal(recs, recommendations);
          return 'summary';
        });

        await cli.findBooks({
          coreBookIDs: ['2'],
          minRating: 3,
          percentile: 4,
          shelfPercentile: 5,
          shelves: ['alfa']
        });

        assert.deepEqual(readOutput(), ['', 'summary']);
      });

      it('removes the separator when logging is disabled', async function() {
        const [cli, readOutput] = createTestCLI({
          logger: createTestLogger({ logLevel: 'none' })[0]
        });

        stub(cli.repo, 'getReadBooks', () => Promise.resolve([]));
        stub(booksSearch, 'findRecommendedBooks', () => Promise.resolve([]));
        stub(booksSearch, 'summarizeRecommendedBooks', () => 'summary');

        await cli.findBooks({
          minRating: 1,
          percentile: 0,
          shelfPercentile: 0
        });

        assert.deepEqual(readOutput(), ['summary']);
      });

    });

    describe('.findReaders', function() {

      function createSimilarReader(id: UserID, books = 1): readersSearch.SimilarReader {
        return {
          books: range(0, books).map(() => createBook()),
          shelves: [],
          user: {
            ...createUser({ id }),
            booksURL: ''
          }
        };
      }

      function listReaderIDs(readers: readersSearch.SimilarReader[]): string {
        return readers
          .map(r => r.user.id)
          .join('\n');
      }

      it('finds readers with similar tastes', async function() {
        const [cli, readOutput] = createTestCLI({ userID: '1' });

        const readBooks: Core.ReadBook[] = [];

        stub(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');
          return Promise.resolve(readBooks);
        });

        stub(readersSearch, 'findSimilarReaders', function(options) {
          return Promise.resolve([
            createSimilarReader('2'),
            createSimilarReader('3')
          ]);
        });

        stub(readersSearch, 'summarizeSimilarReaders', listReaderIDs);

        await cli.findReaders({
          maxReviews: 1,
          shelfPercentile: 0
        });

        assert.deepEqual(readOutput(), ['', '2\n3']);
      });

      it('can filter readers based on the number of matching books', async function() {
        const [cli, readOutput] = createTestCLI();

        stub(cli.repo, 'getReadBooks', () => Promise.resolve([]));

        stub(readersSearch, 'findSimilarReaders', function(options) {
          return Promise.resolve([
            createSimilarReader('2', 1),
            createSimilarReader('3', 2)
          ]);
        });

        stub(readersSearch, 'summarizeSimilarReaders', listReaderIDs);

        await cli.findReaders({
          minBooks: 2,
          maxReviews: 1,
          shelfPercentile: 0
        });

        assert.deepEqual(readOutput(), ['', '3']);
      });

      it('can find readers based on a subset of books', async function() {
        const [cli, readOutput] = createTestCLI();

        stub(cli.repo, 'getReadBooks', function() {
          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        stub(readersSearch, 'findSimilarReaders', function(options) {
          return Promise.resolve(options.readBooks.map(function({ bookID }) {
            return createSimilarReader(bookID);
          }));
        });

        stub(readersSearch, 'summarizeSimilarReaders', listReaderIDs);

        await cli.findReaders({
          bookIDs: ['2'],
          maxReviews: 1,
          shelfPercentile: 0
        });

        assert.deepEqual(readOutput(), ['', '2']);
      });

      it('throws an error when a book ID is not part of the set of read books', async function() {
        const [cli] = createTestCLI();

        stub(cli.repo, 'getReadBooks', function() {
          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        stub(readersSearch, 'findSimilarReaders', () => Promise.resolve([]));
        stub(readersSearch, 'summarizeSimilarReaders', () => 'summary');

        await assert.isRejected(
          cli.findReaders({
            bookIDs: ['4'],
            maxReviews: 1,
            shelfPercentile: 0
          }),
          /No book found with ID: 4/
        );
      });

      it('removes the separator when logging is disabled', async function() {
        const [cli, readOutput] = createTestCLI({
          logger: createTestLogger({ logLevel: 'none' })[0]
        });

        stub(cli.repo, 'getReadBooks', () => Promise.resolve([]));
        stub(readersSearch, 'findSimilarReaders', () => Promise.resolve([]));
        stub(readersSearch, 'summarizeSimilarReaders', () => 'summary');

        await cli.findReaders({
          maxReviews: 1,
          shelfPercentile: 0
        });

        assert.deepEqual(readOutput(), ['summary']);
      });

    });

    describe('.syncBooks', function() {

      it('gets data on a list of read books', async function() {
        const [cli] = createTestCLI({ userID: '1' });

        const ids: BookID[] = [];

        stub(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');

          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        stub(cli.repo, 'getBook', function(id) {
          ids.push(id);
          return Promise.resolve(createBook());
        });

        await cli.syncBooks();

        assert.deepEqual(ids, ['2', '3']);
      });

      it('can limit the number of books fetched', async function() {
        const [cli] = createTestCLI();

        const ids: BookID[] = [];

        stub(cli.repo, 'getReadBooks', function(id) {
          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        stub(cli.repo, 'getBook', function(id) {
          ids.push(id);
          return Promise.resolve(createBook());
        });

        await cli.syncBooks(1);

        assert.deepEqual(ids, ['2']);
      });

    });

    describe('.summarize', function() {

      it('shows a summary of local books', async function() {
        const [cli, readOutput] = createTestCLI({ userID: '1' });

        stub(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');

          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        stub(cli.repo, 'getLocalBooks', function(ids) {
          assert.deepEqual(ids, ['2', '3']);

          return Promise.resolve([
            createBook({ id: '4' }),
            createBook({ id: '5' })
          ]);
        });

        stub(summary, 'summarizeBookshelf', function(bookshelf, options) {
          return bookshelf.getBooks().map(b => b.id);
        });

        await cli.summarize({ shelfPercentile: 0 });

        assert.deepEqual(readOutput(), ['4\n\n5']);
      });

      it('can filter the summary', async function() {
        const [cli, readOutput] = createTestCLI();

        stub(cli.repo, 'getReadBooks', () => Promise.resolve([]));

        stub(cli.repo, 'getLocalBooks', function() {
          return Promise.resolve([
            createBook({
              id: '4',
              shelves: [{ count: 1, name: 'alfa' }]
            }),
            createBook({
              id: '5',
              shelves: [{ count: 1, name: 'bravo' }]
            })
          ]);
        });

        stub(summary, 'summarizeBookshelf', function(bookshelf, options = {}) {
          return [
            ...bookshelf.getShelves().map(s => s.data.name),
            ...(options.sections || [])
          ];
        });

        await cli.summarize({
          sections: ['publishers'],
          shelfPercentile: 0,
          shelves: ['alfa']
        });

        assert.deepEqual(readOutput(), ['alfa\n\npublishers']);
      });

    });

  });

  describe('createCLI', function() {

    it('creates an instance of a CLI', async function() {
      const cli = await createCLI({
        logger: createTestLogger()[0],
        repo: createTestRepo(),
        userID: '1',
        writeOutput: createOutputHandler()[0]
      });

      assert.instanceOf(cli, CLI);
    });

  });

});
