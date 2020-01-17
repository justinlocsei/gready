import { sortBy } from 'lodash';

import { Author, Book, Shelf } from './types/core';
import { AuthorID } from './types/goodreads';
import { formalizeAuthorName, partition } from './content';
import { Partitioned } from './types/util';

interface BooksByAuthor {
  author: Author;
  books: Book[];
}

interface BooksByPublisher {
  books: Book[];
  publisherName: string;
}

interface BooksByShelf {
  books: {
    book: Book;
    percentile: number;
  }[];
  percentile: number;
  shelfName: string;
  totalCount: number;
}

type PartitionedShelf = Partitioned<Shelf>;

export default class Bookshelf {

  private books: Book[];
  private shelfPercentile: number;

  /**
   * Create a new bookshelf
   */
  constructor(books: Book[], {
    shelfPercentile
  }: {
    shelfPercentile: number;
  }) {
    this.books = books;
    this.shelfPercentile = shelfPercentile;
  }

  /**
   * Get all books in the shelf
   */
  getBooks(): Book[] {
    return sortBy(this.books, [
      b => b.title,
      b => b.id
    ]);
  }

  /**
   * Get all books that belong to one or more shelves in a list
   */
  getBooksInShelves(...shelfNames: string[]): Book[] {
    const nameSet = new Set(shelfNames);

    return this.books.filter(book => {
      return this.partitionShelves(book.shelves).find(({ data: shelf, percentile }) => {
        return percentile >= this.shelfPercentile && nameSet.has(shelf.name);
      });
    });
  }

  /**
   * Provide an annotated view of the shelves used by all books
   */
  getAllShelves(): PartitionedShelf[] {
    const countsByName = this.books.reduce(function(previous: Record<string, number>, book) {
      return previous;
    }, {});

    const shelves = Object.keys(countsByName).map(function(name): Shelf {
      return {
        count: countsByName[name],
        name
      };
    });

    return sortBy(this.partitionShelves(shelves), [
      s => s.percentile,
      s => s.data.name
    ]);
  }

  /**
   * Get an annotated view of all shelves at or above the current percentile
   */
  getShelves(): PartitionedShelf[] {
    return this
      .getAllShelves()
      .filter(s => s.percentile >= this.shelfPercentile);
  }

  /**
   * Group all books by author
   */
  groupByAuthor(): BooksByAuthor[] {
    const authorsByID: Record<AuthorID, Author> = {};
    const booksByAuthor: Record<AuthorID, Book[]> = {};

    this.books.forEach(function(book) {
      const author = book.authors[0];

      authorsByID[author.id] = author;

      booksByAuthor[author.id] = booksByAuthor[author.id] || [];
      booksByAuthor[author.id].push(book);
    });

    const sortedAuthorIDs = sortBy(Object.keys(authorsByID), [
      id => formalizeAuthorName(authorsByID[id].name),
      id => id
    ]);

    return sortedAuthorIDs.map(function(id): BooksByAuthor {
      return {
        author: authorsByID[id],
        books: sortBy(booksByAuthor[id], [b => b.title, b => b.id])
      };
    });
  }

  /**
   * Group all books by publisher
   */
  groupByPublisher(): BooksByPublisher[] {
    const byPublisher = this.books.reduce(function(previous: Record<string, Book[]>, book) {
      const { publisher } = book;

      if (publisher) {
        previous[publisher] = previous[publisher] || [];
        previous[publisher].push(book);
      }

      return previous;
    }, {});

    const groups = Object.keys(byPublisher).map(function(publisher): BooksByPublisher {
      return {
        books: sortBy(byPublisher[publisher], [b => b.title, b => b.id]),
        publisherName: publisher
      };
    });

    return sortBy(groups, g => g.publisherName);
  }

  /**
   * Group all books by shelf
   */
  groupByShelf(): BooksByShelf[] {
    const byShelf = this.books.reduce((previous: Record<string, BooksByShelf>, book) => {
      this.partitionShelves(book.shelves).forEach(({ data: shelf, percentile }) => {
        if (percentile < this.shelfPercentile) { return; }

        if (!previous[shelf.name]) {
          previous[shelf.name] = {
            books: [],
            percentile: 0,
            shelfName: shelf.name,
            totalCount: 0
          };
        }

        previous[shelf.name].totalCount += shelf.count;
        previous[shelf.name].books.push({ book, percentile });
      });

      return previous;
    }, {});

    const groups = Object.values(byShelf);
    const mostBooksInShelf = Math.max(...groups.map(g => g.books.length), 1);

    const shelves = Object.values(byShelf).map(function(group) {
      const totalBooks = group.books.length;
      const totalPercentile = group.books.reduce((p, b) => p + b.percentile, 0);

      const percentile = totalBooks / mostBooksInShelf;
      const averagePercentile = totalBooks && totalPercentile / totalBooks;

      return {
        ...group,
        books: sortBy(group.books, [
          b => b.percentile * -1,
          b => b.book.title,
          b => b.book.id
        ]),
        percentile: Math.round((percentile * averagePercentile / 100) * 100)
      };
    });

    return sortBy(
      shelves.filter(s => s.percentile >= this.shelfPercentile),
      [
        s => s.percentile * -1,
        s => s.shelfName
      ]
    );
  }

  /**
   * Create a new bookshelf that only contains books that belong to one or more
   * shelves in a list
   */
  restrictShelves(...shelfNames: string[]): Bookshelf {
    return new Bookshelf(this.getBooksInShelves(...shelfNames), {
      shelfPercentile: this.shelfPercentile
    });
  }

  /**
   * Partition shelves into percentiles
   */
  private partitionShelves(shelves: Shelf[]): PartitionedShelf[] {
    return partition(shelves, s => s.count);
  }

}
