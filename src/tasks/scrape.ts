import { APIClient, createClient } from '../api-client';

class Scraper {

  private client: APIClient;

  /**
   * Create a new object to track the lifecycle of a scraping process
   */
  constructor(client: APIClient) {
    this.client = client;
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
export async function scrape({
  cacheDir,
  dataDir,
  useCache
}: {
  cacheDir: string;
  dataDir: string;
  useCache: boolean;
}): Promise<void> {
  const client = await createClient({
    cacheDir,
    useCache
  });

  return new Scraper(client).scrape();
}
