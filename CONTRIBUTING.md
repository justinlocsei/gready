# Contributing

## Getting Started

To start working on Gready, run the following commands:

```sh
git clone https://github.com/justinlocsei/gready
npm install
npm run build
npm run test
```

Make sure all the tests are passing before making changes.

## Making a Change

Once you have a made a code change, ensure that the tests are still passing and that 100% coverage is maintained by running the following command:

```sh
npm run test:coverage
```

## Running Network Tests

The test suite disallows network access by default, and uses fixtures to test interactions with pre-recorded payloads from the Goodreads API.  If you have a valid API key specified in the `GREADY_GOODREADS_API_KEY` environment variable, you can run tests against the actual API using the following commands:

```sh
GREADY_BYPASS_TEST_FIXTURES=1 npm run test
```

If any of the tests fail, update your code until the tests are once again green.  After doing so, update the test fixtures to reflect the new API responses by running the following commands:

```sh
npm run test:clear-fixtures
GREADY_ALLOW_TEST_FIXTURE_UPDATES=1 npm run test
```

Once you’ve run these commands, you can commit any changed files.
