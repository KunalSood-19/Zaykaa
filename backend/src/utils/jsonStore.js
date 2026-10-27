import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.resolve(__dirname, '../../data');

/**
 * Standard entity ID generator using crypto.randomUUID().
 * @param {string} prefix - Entity domain prefix (e.g., 'usr', 'rst', 'item', 'ord', 'del')
 * @returns {string} Formatted ID (e.g. "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Core JSON Storage Engine providing serialized, atomic persistence operations
 * over local JSON file collections.
 */
export class JsonStore {
  /**
   * @param {string} [dataDir] - Path to directory containing JSON collections
   */
  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    // Map of collectionName -> Promise queue to serialize read-modify-write units
    this.queues = new Map();
  }

  /**
   * Returns absolute file path for a given collection name.
   * @param {string} collectionName
   * @returns {string}
   */
  getFilePath(collectionName) {
    return path.join(this.dataDir, `${collectionName}.json`);
  }

  /**
   * Serializes operations for a given collection to prevent race conditions.
   * Ensures read-modify-write units run sequentially per collection.
   * @private
   */
  _serialize(collectionName, taskFn) {
    const currentQueue = this.queues.get(collectionName) || Promise.resolve();
    const nextQueue = currentQueue
      .then(() => taskFn())
      .finally(() => {
        if (this.queues.get(collectionName) === nextQueue) {
          this.queues.delete(collectionName);
        }
      });

    this.queues.set(collectionName, nextQueue);
    return nextQueue;
  }

  /**
   * Serializes operations across multiple collections in deterministic sorted order
   * to prevent deadlocks and guarantee concurrency safety for multi-collection workflows.
   * @param {Array<string>} collections
   * @param {Function} taskFn
   * @returns {Promise<any>}
   */
  _serializeMulti(collections, taskFn) {
    if (!Array.isArray(collections) || collections.length === 0) {
      return taskFn();
    }
    const sorted = [...new Set(collections)].sort();
    const acquireAndRun = (index) => {
      if (index >= sorted.length) {
        return taskFn();
      }
      return this._serialize(sorted[index], () => acquireAndRun(index + 1));
    };
    return acquireAndRun(0);
  }

  /**
   * Ensures the storage directory exists.
   * @private
   */
  async _ensureDataDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  /**
   * Reads raw collection from disk. If file is missing, creates it with `[]`.
   * Throws an error if file exists but contains invalid JSON or non-array data.
   * @param {string} collectionName
   * @returns {Promise<Array<object>>}
   */
  async readCollection(collectionName) {
    await this._ensureDataDir();
    const filePath = this.getFilePath(collectionName);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // If file is completely empty string, throw error to avoid silent data loss
      if (!content || !content.trim()) {
        throw new Error(`Corrupted collection: '${collectionName}.json' is empty or invalid JSON`);
      }

      const data = JSON.parse(content);
      if (!Array.isArray(data)) {
        throw new Error(`Invalid collection format: '${collectionName}.json' must contain a JSON array`);
      }

      return data;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Missing collection: auto-initialize with empty array
        const initial = [];
        await this._writeAtomic(collectionName, initial);
        return initial;
      }
      // Re-throw JSON parsing or corrupt data errors
      throw err;
    }
  }

  /**
   * Atomically writes data to disk using temporary file creation and rename.
   * @private
   * @param {string} collectionName
   * @param {Array<object>} data
   */
  async _writeAtomic(collectionName, data) {
    await this._ensureDataDir();
    const targetPath = this.getFilePath(collectionName);
    const tempPath = `${targetPath}.${crypto.randomUUID()}.tmp`;

    try {
      const serialized = JSON.stringify(data, null, 2) + '\n';
      await fs.writeFile(tempPath, serialized, 'utf8');
      await fs.rename(tempPath, targetPath);
    } catch (err) {
      // Clean up temporary file if write or rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore unlink error if temp file was never created
      }
      throw new Error(`Failed to write collection '${collectionName}': ${err.message}`);
    }
  }

  /**
   * Finds a single record by ID.
   * @param {string} collectionName
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(collectionName, id) {
    if (!id) return null;
    const items = await this.readCollection(collectionName);
    const found = items.find((item) => item.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  /**
   * Retrieves all records matching an optional filter predicate.
   * @param {string} collectionName
   * @param {Function} [filterFn] - Optional predicate (item => boolean)
   * @returns {Promise<Array<object>>}
   */
  async findAll(collectionName, filterFn) {
    const items = await this.readCollection(collectionName);
    const results = typeof filterFn === 'function' ? items.filter(filterFn) : items;
    return JSON.parse(JSON.stringify(results));
  }

  /**
   * Creates a new record in the collection.
   * Entire read-modify-write unit is serialized to prevent lost updates.
   * @param {string} collectionName
   * @param {object} data
   * @param {string} [prefix] - Entity prefix for ID generation
   * @returns {Promise<object>}
   */
  async create(collectionName, data, prefix = 'id') {
    return this._serialize(collectionName, async () => {
      const items = await this.readCollection(collectionName);
      const now = new Date().toISOString();

      const newRecord = {
        id: data.id || generateId(prefix),
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: now,
      };

      items.push(newRecord);
      await this._writeAtomic(collectionName, items);
      return JSON.parse(JSON.stringify(newRecord));
    });
  }

  /**
   * Updates an existing record by ID.
   * Entire read-modify-write unit is serialized.
   * Preserves original `id` and `createdAt`.
   * @param {string} collectionName
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object|null>} Returns updated record or null if not found.
   */
  async update(collectionName, id, updateData) {
    if (!id) return null;

    return this._serialize(collectionName, async () => {
      const items = await this.readCollection(collectionName);
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        return null;
      }

      const existing = items[index];
      const updatedRecord = {
        ...existing,
        ...updateData,
        id: existing.id, // Immutable ID
        createdAt: existing.createdAt, // Immutable createdAt
        updatedAt: new Date().toISOString(),
      };

      items[index] = updatedRecord;
      await this._writeAtomic(collectionName, items);
      return JSON.parse(JSON.stringify(updatedRecord));
    });
  }

  /**
   * Deletes a record by ID.
   * Entire read-modify-write unit is serialized.
   * @param {string} collectionName
   * @param {string} id
   * @returns {Promise<boolean>} True if removed, false if not found.
   */
  async delete(collectionName, id) {
    if (!id) return false;

    return this._serialize(collectionName, async () => {
      const items = await this.readCollection(collectionName);
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        return false;
      }

      items.splice(index, 1);
      await this._writeAtomic(collectionName, items);
      return true;
    });
  }
}

// Default singleton instance pointing to backend/data
const defaultJsonStore = new JsonStore(DEFAULT_DATA_DIR);
export default defaultJsonStore;
