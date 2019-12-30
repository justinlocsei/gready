import APIClient from '../api-client';

class Scraper {

  private client: APIClient;
  private dataDir: string;

  /**
   * Create a new object to track the lifecycle of a scraping process
   */
  constructor(client: APIClient, dataDir: string) {
    this.client = client;
    this.dataDir = dataDir;
  }

  /**
   * Scrape data from Goodreads
   */
  async scrape(): Promise<void> {
    console.error(await this.client.getUserID()); // TODO: delete me
  }

}

/**
 * Scrape data from Goodreads
 */
export async function scrape({
  client,
  dataDir
}: {
  client: APIClient;
  dataDir: string;
}): Promise<void> {
  return new Scraper(client, dataDir).scrape();
}
