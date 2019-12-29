import APIClient from '../api-client';

interface ScraperOptions {
  cacheDir: string;
  dataDir: string;
}

class Scraper {

  private client: APIClient;

  /**
   * Create a new object to track the lifecycle of a scraping process
   *
   * @param {ScraperOptions} options [description]
   */
  constructor(options: ScraperOptions) {
    this.client = new APIClient({
      cacheDir: options.cacheDir
    });
  }

  /**
   * Scrape data from Goodreads
   */
  async scrape(): Promise<void> {

  }

}

/**
 * Scrape data from Goodreads
 */
export function scrape(options: ScraperOptions): Promise<void> {
  return new Scraper(options).scrape();
}
