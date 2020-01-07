import * as API from './types/api';
import APIClient from './api-client';
import Cache from './cache';
import { ensureArray } from './data';

import {
  Author,
  Book,
  BookReview,
  Category
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
      const book = await this.apiClient.getBookInfo(id);
      return this.normalizeBookInfo(book);
    });
  }

  /**
   * Get all reviews left by a user
   */
  getReviewsForUser(userID: UserID): Promise<BookReview[]> {
    return this.cache.fetch(['reviews', userID], async () => {
      const reviews = await this.apiClient.getReadBooks(userID);
      return reviews.map(this.normalizeReview);
    });
  }

  /**
   * Convert a review from the API to a book review
   */
  private normalizeReview(review: API.BookReview): BookReview {
    return {
      bookID: review.book.id._,
      rating: parseInt(review.rating, 10)
    };
  }

  /**
   * Convert book information from the API to a book
   */
  private normalizeBookInfo(info: API.BookInfo): Book {
    const { authors: rawAuthors, id, publisher, work } = info;

    const ratingsSum = parseInt(work.ratings_sum._, 10);
    const totalRatings = parseInt(work.ratings_count._, 10);

    const authors = ensureArray(rawAuthors.author).map(function(author): Author {
      return {
        id: author.id,
        name: author.name
      };
    });

    const categories = info.popular_shelves.shelf.map(function({ $: shelf }): Category {
      return {
        count: parseInt(shelf.count, 10),
        name: shelf.name
      };
    });

    return {
      authors,
      averageRating: totalRatings > 0 ? ratingsSum / totalRatings : undefined,
      categories,
      id,
      publisher,
      similarBooks: info.similar_books.book.map(b => b.id),
      totalRatings,
      workID: work.id._
    };
  }

}
