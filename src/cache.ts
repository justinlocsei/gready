import glob from 'glob';
import path from 'path';
import { mkdirp, remove } from 'fs-extra';
import { promisify } from 'util';
import { readdir, readFile, writeFile } from 'graceful-fs';

import { ExtractArrayType } from './types/util';
import { formatJSON } from './serialization';
import { unreachable } from './util';

const globAsync = promisify(glob);
const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

export const ENCODINGS = ['base64', 'utf-8'] as const;

type Encoding = ExtractArrayType<typeof ENCODINGS>;
export type KeyPath = (number | string)[];

interface NamespaceStats {
  items: number;
  namespace: string;
}

export interface CacheOptions {
  enabled: boolean;
  encoding: Encoding;
}

const EXTENSIONS: Record<Encoding, string> = {
  base64: 'txt',
  'utf-8': 'json'
};

class CacheClass {

  readonly directory: string;
  readonly isEnabled: boolean;

  private extension: string;
  private createdDirectories: Set<string>;
  private options: CacheOptions;

  /**
   * Create a new interface to a filesystem cache
   */
  constructor(directory: string, options: Partial<CacheOptions> = {}) {
    this.directory = directory;

    this.options = {
      enabled: true,
      encoding: 'utf-8',
      ...options
    };

    this.isEnabled = this.options.enabled;
    this.createdDirectories = new Set();
    this.extension = EXTENSIONS[this.options.encoding];
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

    const parseRequests = entries.sort().map(async (file): Promise<T> => {
      return this.deserializeValue(await readFileAsync(path.join(dirPath, file), 'utf8'));
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
      return computeValue();
    }

    try {
      return this.deserializeValue(await readFileAsync(cacheFile, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.storeValue(cacheFile, computeValue);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get stats on all namespaces in the cache
   */
  async stats(): Promise<NamespaceStats[]> {
    const namespaces = await readdirAsync(this.directory);

    const stats = namespaces.sort().map(async (namespace): Promise<NamespaceStats> => {
      const entries = await globAsync(path.join(this.directory, namespace, '**', `*.${this.extension}`));

      return {
        items: entries.length,
        namespace
      };
    });

    return Promise.all(stats);
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
      path.join(absoluteDir, `${keyName}.${this.extension}`)
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

    await writeFileAsync(filePath, this.serializeValue(value));

    return value;
  }

  /**
   * Serialize a cached value
   */
  private serializeValue(value: unknown): string {
    const { encoding } = this.options;

    const asJSON = formatJSON(value);

    switch (encoding) {
      case 'base64':
        return Buffer.from(asJSON).toString('base64');

      case 'utf-8':
        return asJSON;

      /* istanbul ignore next */
      default:
        unreachable(encoding);
    }
  }

  /**
   * Deserialize a cached value
   */
  private deserializeValue<T>(serialized: string): T {
    const { encoding } = this.options;

    let data: string;

    switch (encoding) {
      case 'base64':
        data = Buffer.from(serialized, 'base64').toString();
        break;

      case 'utf-8':
        data = serialized;
        break;

      /* istanbul ignore next */
      default:
        unreachable(encoding);
    }

    return JSON.parse(data);
  }

}

export type Cache = InstanceType<typeof CacheClass>;

/**
 * Create a cache
 */
export function createCache(...args: ConstructorParameters<typeof CacheClass>): Cache {
  return new CacheClass(...args);
}
