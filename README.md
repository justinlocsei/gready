# Gready

Gready is a command-line tool that uses your Goodreads reading history to recommend books and find Goodreads users with similar interests.

## Usage

To install the latest version of Gready, run the following command:

```sh
npm install -g gready
```

Gready uses the Goodreads API to get information on your reading history, and requires [a valid API key](https://www.goodreads.com/api/keys) and user ID.  To determine your user ID, visit the “My Books” page on Goodreads and take the number to the right of the final slash in the URL.

Once you’ve obtained these values, you can expose them to Gready by setting the following environment variables:

* `GREADY_GOODREADS_API_KEY`: Your Goodreads API key
* `GREADY_GOODREADS_USER_ID`: Your Goodreads user ID

With Gready installed and the required environment variables set, you can run the following commands to see Gready’s recommendations based on your Goodreads reading history:

```sh
# Create a local copy of your Goodreads reading history
gready sync-books

# Print a summary of the books that you’ve read
gready summarize

# Generate a list of book recommendations
gready find-books

# Generate a list of Goodreads users with similar interests
gready find-readers
```

Each of the above commands writes Markdown to `stdout`, allowing you to pipe any command’s output to a file that you can open in a Markdown viewer.  For example, to create a file containing the summary of your reading history, you could run the following command:

```sh
gready summarize > summary.md
```

Gready can display both global and per-command options by using the following commands:

```sh
# Show global options and available commands
gready --help

# Show command-specific options
gready <command-name> --help
```

### Configuration

The recommendations made by Gready can be controlled via a JSON configuration file that allows you to filter and customize book data.  Gready looks for a configuration file at `~/.greadyrc` by default, but you can specify a different path by passing the `--config=<path-to-file>` option to any Gready command.  An example configuration file with explanatory comments is shown below:

```javascript
{
  // A list of the full names of authors whose works should not appear in the
  // list of books produced by `gready find-books`
  "ignoreAuthors": [
    "First Last",
    "First Middle Last"
  ],

  // A list of shelves to ignore
  //
  // By default, all shelves for each book are shown, which includes frequently
  // used shelves like “library” or “owned” whose presence can make more
  // specific shelves defining the genre of a book appear in a much lower
  // percentile.  To view all shelves associated with the books that you’ve
  // read, use `gready summarize --section=shelves --shelf-percentile=1`.
  "ignoreShelves": [
    "audio",
    "series"
  ],

  // A mapping of publishers to lists of other publishers to treat as aliases
  //
  // The publishers associated with your read books can be shown using the
  // `gready summarize` command, which will also use these publisher aliases
  // to consolidate the list of books by publisher.
  "publisherAliases": {
    "Publisher": [
      "Imprint One",
      "Imprint Two"
    ]
  },

  // A mapping of shelves to lists of other shelves to treat as aliases
  //
  // These aliases are used to ensure that only the top-level shelves are shown
  // in any Gready output, which can make searching for recommendations in a
  // particular genre easier.
  "shelfAliases": {
    "science-fiction": [
      "sci-fi",
      "scifi"
    ]
  },

  // The percentile in which a shelf must be found in order to be shown
  //
  // This is used both on a per-book level to determine which shelves are
  // associated with a book and at a higher level to control which shelves get
  // displayed in the summary.  When combined with the `shelfAliases` option,
  // this can be used to treat shelves as an approximation of genres.
  "shelfPercentile": 90
}
```

All sections in the configuration are optional.  For example, you can define a list of publisher aliases while relying on the default values for all other config sections.

## Commands

The `gready` executable requires a command that defines its mode of operation.  The available commands, as well as examples of their usage, are provided in the following sections.

### clear-cache

This command clears any cached API responses or data generated as a result of analyzing your reading history.

```sh
# Clear all cached data
gready clear-cache

# Only clear cached API responses
gready clear-cache --cache=responses

# Only clear cached book analyses
gready clear-cache --cache=data --namespace=books
```

### find-books

This command takes the similar books provided by Goodreads for each book in your reading history and organizes them into percentiles based upon how many times a book is listed as similar to one that you have read.

```sh
# Generate a list of recommended books
gready find-books

# Only generate recommendations based on books to which you’ve given at least a four-star rating
gready find-books --min-rating=4

# Only show books in the 90th percentile, as determined by the number of times they’re suggested as a similar book
gready find-books --percentile=90

# Only generate recommendations based on the fantasy books that you’ve read
gready find-books --shelf=fantasy

# Only show the top five recommendations
gready find-books --limit=5
```

### find-readers

This command combines the most popular Goodreads reviews of each book in your reading history left by a reader who used the same star rating as you and organizes them into percentiles based on how many times a reviewer with a shared rating appeared.

```sh
# Generate a list of Goodreads users with similar interests
gready find-readers

# Only show users who have given at least three books the same rating as you
gready find-readers --min-books=3

# Find users based on the twenty most popular reviews of each book
gready find-readers --reviews=20

# Only show users who have given the same rating as you to a specific book
gready find-readers --book-id=<book-id>
```

### show-cache-stats

This command displays information on the entries in the cache.  It can be used to show the available namespaces for each cache, which you can pass to `gready clear-cache` to clear a subset of cached data.

```sh
# Print a summary of cached API responses and data
gready show-cache-stats
```

### summarize

This command shows a summary of your locally available reading history as pulled down by `sync-books`.  As with the other Gready commands, this summary is formatted using Markdown, so you can pipe it to a file for a better viewing experience.

```sh
# Print a summary of the books that you’ve read
gready summarize

# Only show the publisher-related sections
gready summarize --section=books-by-publisher --section=publishers

# Only include fiction books in the summary
gready summarize --shelf=fiction
```

### sync-books

This command creates a local record of your Goodreads reading history.  This data is also fetched when running the `find-books` and `find-readers` commands, making `sync-books` a convenience command to prime the cache for the find commands.  However, the `summarize` command will only summarize the local copy of your reading history.

```sh
# Create a local copy of your reading history
gready sync-books

# Only sync data for your five most recently read books
gready sync-books --recent-books=5
```
