import { sortBy } from 'lodash';

import * as API from './types/api';
import APIClient from './api-client';
import Cache from './cache';
import { ensureArray, normalizeString } from './data';

import {
  Author,
  Book,
  Category,
  ReadBook,
  Review
} from './types/data';

import {
  BookID,
  UserID
} from './types/goodreads';

export default class Repository {

  private apiClient: APIClient;
  private cache: Cache;

  /**
   * Create a data repository
   */
  constructor(apiClient: APIClient, cache: Cache) {
    this.apiClient = apiClient;
    this.cache = cache;
  }

  /**
   * Get information on a book
   */
  getBook(id: BookID): Promise<Book> {
    return this.cache.fetch(['books', id], async () => {
      const book = await this.apiClient.getBook(id);
      return this.normalizeBookInfo(book);
    });
  }

  /**
   * Get all books read by a user, with the most recently read books first
   */
  getReadBooks(userID: UserID): Promise<ReadBook[]> {
    return this.cache.fetch(['read-books', userID], async () => {
      const books = await this.apiClient.getReadBooks(userID);

      return sortBy(
        books.map(this.normalizeReadBook),
        [
          b => b.readOn * -1,
          b => b.id
        ]
      );
    });
  }

  /**
   * Convert a review from the API to a book review
   */
  private normalizeReadBook(book: API.ReadBook): ReadBook {
    return {
      id: book.book.id._,
      rating: parseInt(book.rating, 10),
      readOn: new Date(book.date_updated).getTime()
    };
  }

  /**
   * Convert book information from the API to a book
   */
  private async normalizeBookInfo(book: API.Book): Promise<Book> {
    const { authors: rawAuthors, id, work } = book;

    const ratingsSum = parseInt(work.ratings_sum._, 10);
    const totalRatings = parseInt(work.ratings_count._, 10);

    const authors = ensureArray(rawAuthors.author).map(function(author): Author {
      return {
        id: author.id,
        name: normalizeString(author.name)
      };
    });

    const categories = book.popular_shelves.shelf.map(function({ $: shelf }): Category {
      return {
        count: parseInt(shelf.count, 10),
        name: normalizeString(shelf.name)
      };
    });

    const reviews = await this.apiClient.extractReviewsFromWidget(book.reviews_widget);

    const topReviews = reviews.map(function(review): Review {
      return {
        rating: parseInt(review.rating, 10),
        userID: review.user.id
      };
    });

    const publisher = this.determinePublisher(
      book.publisher,
      reviews.map(r => r.book.publisher)
    );

    return {
      authors,
      averageRating: totalRatings > 0 ? ratingsSum / totalRatings : undefined,
      categories,
      id,
      publisher,
      similarBooks: book.similar_books.book.map(b => b.id),
      title: normalizeString(work.original_title),
      topReviews,
      totalRatings,
      workID: work.id._
    };
  }

  /**
   * Determine the publisher of a book by taking the most popular publisher from
   * the book's official data and its reviews
   */
  private determinePublisher(official: string, fromReviews: string[]): string | undefined {
    const ranked = fromReviews.reduce(function(previous, publisher) {
      previous[publisher] = previous[publisher] || 0;
      previous[publisher]++;

      return previous;
    }, { [official]: 1 });

    const ordered = sortBy(
      Object.keys(ranked).filter(Boolean),
      [
        k => ranked[k] * -1,
        k => k
      ]
    );

    return ordered.shift();
  }

}
