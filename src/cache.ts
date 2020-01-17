import path from 'path';
import { mkdirp, remove } from 'fs-extra';
import { promisify } from 'util';
import { readdir, readFile, writeFile } from 'graceful-fs';

import { formatJSON } from './serialization';

const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

type KeyPath = (number | string)[];

export interface Options {
  enabled?: boolean;
}

export default class Cache {

  private directory: string;
  private createdDirectories: Set<string>;
  private options: Options;

  /**
   * Create a new interface to a filesystem cache
   */
  constructor(directory: string, options: Options = {}) {
    this.directory = directory;

    this.options = {
      enabled: true,
      ...options
    };

    this.createdDirectories = new Set();
  }

  /**
   * Clear the cache
   */
  async clear(namespaces?: string[]): Promise<void> {
    const names = namespaces || await readdirAsync(this.directory);
    const dirPaths = names.sort().map(n => path.join(this.directory, n));

    const removals = dirPaths.map(dirPath => {
      this.createdDirectories.delete(path.relative(this.directory, dirPath));
      return remove(dirPath);
    });

    await Promise.all(removals);
  }

  /**
   * Return all entries in a given namespace
   */
  async entries<T>(namespace: KeyPath): Promise<T[]> {
    const dirPath = path.join(this.directory, ...namespace.map(p => p.toString()));
    let entries: string[];

    try {
      entries = await readdirAsync(dirPath);
    } catch {
      return [];
    }

    const parseRequests = entries.sort().map(function(file) {
      return readFileAsync(path.join(dirPath, file), 'utf8').then(t => JSON.parse(t) as T);
    });

    return Promise.all(parseRequests);
  }

  /**
   * Fetch a value from the cache
   *
   * In the event of a cache miss, or when the cache is not enabled, this will
   * call the computation function.
   */
  async fetch<T>(
    keyPath: KeyPath,
    computeValue: () => Promise<T>
  ): Promise<T> {
    const cacheFile = await this.prepareFS(keyPath);

    if (!this.options.enabled) {
      return this.storeValue(cacheFile, computeValue);
    }

    try {
      const cached = await readFileAsync(cacheFile, 'utf8');
      return JSON.parse(cached);
    } catch(error) {
      if (error.code === 'ENOENT') {
        return this.storeValue(cacheFile, computeValue);
      } else {
        throw error;
      }
    }
  }

  /**
   * Prepare the filesystem to receive a cached file
   */
  private prepareFS(keyPath: KeyPath): Promise<string> {
    const [relativeDir, absoluteDir, filePath] = this.keyToPaths(keyPath);

    if (this.createdDirectories.has(relativeDir)) {
      return Promise.resolve(filePath);
    }

    return mkdirp(absoluteDir).then(() => {
      this.createdDirectories.add(relativeDir);
      return filePath;
    });
  }

  /**
   * Determine the paths required to store a value
   */
  private keyToPaths(keyPath: KeyPath): [string, string, string] {
    const dirParts = keyPath.slice(0, -1).map(p => p.toString());
    const keyName = keyPath[keyPath.length - 1];

    const relativeDir = path.join(...dirParts);
    const absoluteDir = path.join(this.directory, relativeDir);

    return [
      relativeDir,
      absoluteDir,
      path.join(absoluteDir, `${keyName}.json`)
    ];
  }

  /**
   * Compute a value and store it in the cache
   */
  private async storeValue<T>(
    filePath: string,
    computeValue: () => Promise<T>
  ): Promise<T> {
    const value = await computeValue();
    await writeFileAsync(filePath, formatJSON(value));

    return value;
  }

}
