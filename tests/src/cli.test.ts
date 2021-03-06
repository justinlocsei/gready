import { range } from 'lodash';

import * as booksSearch from '../../src/search/books';
import * as Core from '../../src/types/core';
import * as readersSearch from '../../src/search/readers';
import * as summary from '../../src/summary';
import assert, { expectAssertions } from '../helpers/assert';
import { allowOverrides } from '../helpers/mocking';
import { BookID, UserID } from '../../src/types/goodreads';
import { createBook, createReadBook, createUser } from '../helpers/factories';
import { createCLI, CLI } from '../../src/cli';
import { createOutputHandler, createTestConfig, createTestLogger, createTestRepo, OutputReader } from '../helpers';
import { Logger } from '../../src/logger';
import { OutputHandler } from '../../src/types/system';

describe('cli', function() {

  const override = allowOverrides(this);

  describe('CLI', function() {

    function createTestCLI({
      logger,
      recentBooks,
      userID = '1',
      writeOutput
    }: {
      logger?: Logger;
      recentBooks?: number;
      userID?: UserID;
      writeOutput?: OutputHandler;
    } = {}): [CLI, OutputReader] {
      const [handleOutput, readOutput] = createOutputHandler();

      const cli = new CLI({
        config: createTestConfig(),
        logger: logger || createTestLogger()[0],
        recentBooks,
        repo: createTestRepo(),
        userID,
        writeOutput: handleOutput
      });

      return [cli, readOutput];
    }

    async function checkRecentBooks(runTest: (cli: CLI) => Promise<void>) {
      const plan = expectAssertions(2);

      const [low] = createTestCLI({ recentBooks: 1 });
      const [high] = createTestCLI({ recentBooks: 10 });

      override(low.repo, 'getReadBooks', function(_, options = {}) {
        plan.checkpoint(function() {
          assert.equal(options.recent, 1);
        });

        return Promise.resolve([]);
      });

      override(high.repo, 'getReadBooks', function(_, options = {}) {
        plan.checkpoint(function() {
          assert.equal(options.recent, 10);
        });

        return Promise.resolve([]);
      });

      await runTest(low);
      await runTest(high);

      plan.verify();
    }

    describe('.findBooks', function() {

      it('finds and summarizes recommended books', async function() {
        const [cli, readOutput] = createTestCLI({ userID: '1' });

        const readBooks: Core.ReadBook[] = [];
        const recommendations: booksSearch.PartitionedRecommendation[] = [];

        override(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');
          return Promise.resolve(readBooks);
        });

        override(booksSearch, 'findRecommendedBooks', function(options) {
          assert.deepEqual(options, {
            config: cli.config,
            coreBookIDs: ['2'],
            limit: 5,
            minRating: 3,
            percentile: 4,
            readBooks,
            repo: cli.repo,
            shelves: ['alfa']
          });

          return Promise.resolve(recommendations);
        });

        override(booksSearch, 'summarizeRecommendedBooks', function(recs) {
          assert.equal(recs, recommendations);
          return 'summary';
        });

        await cli.findBooks({
          coreBookIDs: ['2'],
          limit: 5,
          minRating: 3,
          percentile: 4,
          shelves: ['alfa']
        });

        assert.deepEqual(readOutput(), ['', 'summary']);
      });

      it('removes the separator when logging is disabled', async function() {
        const [cli, readOutput] = createTestCLI({
          logger: createTestLogger({ logLevel: 'none' })[0]
        });

        override(cli.repo, 'getReadBooks', () => Promise.resolve([]));
        override(booksSearch, 'findRecommendedBooks', () => Promise.resolve([]));
        override(booksSearch, 'summarizeRecommendedBooks', () => 'summary');

        await cli.findBooks({
          minRating: 1,
          percentile: 0
        });

        assert.deepEqual(readOutput(), ['summary']);
      });

      it('can limit the number of books used to generate recommendations', async function() {
        override(booksSearch, 'findRecommendedBooks', () => Promise.resolve([]));
        override(booksSearch, 'summarizeRecommendedBooks', () => '');

        await checkRecentBooks(async function(cli) {
          await cli.findBooks({ minRating: 1, percentile: 0 });
        });
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

        override(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');
          return Promise.resolve(readBooks);
        });

        override(readersSearch, 'findSimilarReaders', function(options) {
          return Promise.resolve([
            createSimilarReader('2'),
            createSimilarReader('3')
          ]);
        });

        override(readersSearch, 'summarizeSimilarReaders', listReaderIDs);

        await cli.findReaders({
          maxReviews: 1
        });

        assert.deepEqual(readOutput(), ['', '2', '3']);
      });

      it('can filter readers based on the number of matching books', async function() {
        const [cli, readOutput] = createTestCLI();

        override(cli.repo, 'getReadBooks', () => Promise.resolve([]));

        override(readersSearch, 'findSimilarReaders', function(options) {
          return Promise.resolve([
            createSimilarReader('2', 1),
            createSimilarReader('3', 2)
          ]);
        });

        override(readersSearch, 'summarizeSimilarReaders', listReaderIDs);

        await cli.findReaders({
          minBooks: 2,
          maxReviews: 1
        });

        assert.deepEqual(readOutput(), ['', '3']);
      });

      it('can find readers based on a subset of books', async function() {
        const [cli, readOutput] = createTestCLI();

        override(cli.repo, 'getReadBooks', function() {
          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        override(readersSearch, 'findSimilarReaders', function(options) {
          return Promise.resolve(options.readBooks.map(function({ bookID }) {
            return createSimilarReader(bookID);
          }));
        });

        override(readersSearch, 'summarizeSimilarReaders', listReaderIDs);

        await cli.findReaders({
          bookIDs: ['2'],
          maxReviews: 1
        });

        assert.deepEqual(readOutput(), ['', '2']);
      });

      it('throws an error when a book ID is not part of the set of read books', async function() {
        const [cli] = createTestCLI();

        override(cli.repo, 'getReadBooks', function() {
          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        override(readersSearch, 'findSimilarReaders', () => Promise.resolve([]));
        override(readersSearch, 'summarizeSimilarReaders', () => 'summary');

        await assert.isRejected(
          cli.findReaders({
            bookIDs: ['4'],
            maxReviews: 1
          }),
          /No book found with ID: 4/
        );
      });

      it('removes the separator when logging is disabled', async function() {
        const [cli, readOutput] = createTestCLI({
          logger: createTestLogger({ logLevel: 'none' })[0]
        });

        override(cli.repo, 'getReadBooks', () => Promise.resolve([]));
        override(readersSearch, 'findSimilarReaders', () => Promise.resolve([]));
        override(readersSearch, 'summarizeSimilarReaders', () => 'summary');

        await cli.findReaders({
          maxReviews: 1
        });

        assert.deepEqual(readOutput(), ['summary']);
      });

      it('can limit the number of books used for finding readers', async function() {
        override(readersSearch, 'findSimilarReaders', () => Promise.resolve([]));
        override(readersSearch, 'summarizeSimilarReaders', () => 'summary');

        await checkRecentBooks(async function(cli) {
          await cli.findReaders({ maxReviews: 1 });
        });
      });

    });

    describe('.syncBooks', function() {

      it('gets data on a list of read books', async function() {
        const [cli] = createTestCLI({ userID: '1' });

        const ids: BookID[] = [];

        override(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');

          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        override(cli.repo, 'getBook', function(id) {
          ids.push(id);
          return Promise.resolve(createBook());
        });

        await cli.syncBooks();

        assert.deepEqual(ids, ['2', '3']);
      });

      it('can limit the number of synced books', async function() {
        await checkRecentBooks(async function(cli) {
          await cli.syncBooks();
        });
      });

    });

    describe('.summarize', function() {

      it('shows a summary of local books', async function() {
        const [cli, readOutput] = createTestCLI({ userID: '1' });

        override(cli.repo, 'getReadBooks', function(id) {
          assert.equal(id, '1');

          return Promise.resolve([
            createReadBook({ bookID: '2' }),
            createReadBook({ bookID: '3' })
          ]);
        });

        override(cli.repo, 'getLocalBooks', function(ids) {
          assert.deepEqual(ids, ['2', '3']);

          return Promise.resolve([
            createBook({ id: '4' }),
            createBook({ id: '5' })
          ]);
        });

        override(summary, 'summarizeBookshelf', function(bookshelf, options) {
          return bookshelf.getBooks().map(b => b.id);
        });

        await cli.summarize();

        assert.deepEqual(readOutput(), ['4', '', '5']);
      });

      it('can filter the summary', async function() {
        const [cli, readOutput] = createTestCLI();

        override(cli.repo, 'getReadBooks', () => Promise.resolve([]));

        override(cli.repo, 'getLocalBooks', function() {
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

        override(summary, 'summarizeBookshelf', function(bookshelf, options = {}) {
          return [
            ...bookshelf.getShelves().map(s => s.data.name),
            ...(options.sections || [])
          ];
        });

        await cli.summarize({
          sections: ['publishers'],
          shelves: ['alfa']
        });

        assert.deepEqual(readOutput(), ['alfa', '', 'publishers']);
      });

    });

    it('can limit the number of summarized books', async function() {
      override(summary, 'summarizeBookshelf', () => []);

      await checkRecentBooks(async function(cli) {
        await cli.summarize();
      });
    });

  });

  describe('createCLI', function() {

    it('creates an instance of a CLI', async function() {
      const cli = await createCLI({
        config: createTestConfig(),
        logger: createTestLogger()[0],
        repo: createTestRepo(),
        userID: '1',
        writeOutput: createOutputHandler()[0]
      });

      assert.instanceOf(cli, CLI);
    });

  });

});
