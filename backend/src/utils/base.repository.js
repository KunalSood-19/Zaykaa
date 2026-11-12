import { readJson, writeJson } from './jsonStorage.js';

/**
 * BaseRepository — Abstract Data Access Object for Phase CE-1
 *
 * Implements standard CRUD operations over file-based JSON collections.
 * Encapsulates persistence completely, guaranteeing zero changes to
 * Services or Controllers when migrating to Mongoose in Phase CE-2.
 */
export class BaseRepository {
  /**
   * @param {string} fileName - Target file under backend/data (e.g., 'orders.json')
   * @param {string} [primaryKey='id'] - The primary key attribute ('id' or 'itemId')
   */
  constructor(fileName, primaryKey = 'id') {
    this.fileName = fileName;
    this.primaryKey = primaryKey;
  }

  /**
   * Find a single record by its primary key
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const records = await readJson(this.fileName);
    const found = records.find((item) => String(item[this.primaryKey]) === String(id));
    return found ? { ...found } : null;
  }

  /**
   * Find all records with an optional filter predicate
   * @param {Function} [filterFn] - Optional filtering predicate
   * @returns {Promise<Array<Object>>}
   */
  async findAll(filterFn = null) {
    const records = await readJson(this.fileName);
    if (typeof filterFn === 'function') {
      return records.filter(filterFn).map((item) => ({ ...item }));
    }
    return records.map((item) => ({ ...item }));
  }

  /**
   * Create and persist a new record
   * @param {Object} entity
   * @returns {Promise<Object>}
   */
  async create(entity) {
    const records = await readJson(this.fileName);
    const now = new Date().toISOString();

    const newRecord = {
      ...entity,
      createdAt: entity.createdAt || now,
      updatedAt: entity.updatedAt || now
    };

    records.push(newRecord);
    await writeJson(this.fileName, records);
    return { ...newRecord };
  }

  /**
   * Partially or completely update an existing record
   * @param {string} id
   * @param {Object} partialEntity
   * @returns {Promise<Object|null>}
   */
  async update(id, partialEntity) {
    if (!id) return null;
    const records = await readJson(this.fileName);
    const index = records.findIndex((item) => String(item[this.primaryKey]) === String(id));

    if (index === -1) {
      return null;
    }

    const existing = records[index];
    const updatedRecord = {
      ...existing,
      ...partialEntity,
      [this.primaryKey]: existing[this.primaryKey], // Primary key cannot be mutated
      createdAt: existing.createdAt, // Created timestamp preserved
      updatedAt: new Date().toISOString()
    };

    records[index] = updatedRecord;
    await writeJson(this.fileName, records);
    return { ...updatedRecord };
  }

  /**
   * Delete a record by its primary key
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!id) return false;
    const records = await readJson(this.fileName);
    const index = records.findIndex((item) => String(item[this.primaryKey]) === String(id));

    if (index === -1) {
      return false;
    }

    records.splice(index, 1);
    await writeJson(this.fileName, records);
    return true;
  }
}
