import defaultJsonStore from '../../utils/jsonStore.js';

export class CustomerRepository {
  /**
   * @param {import('../../utils/jsonStore.js').JsonStore} [store]
   */
  constructor(store = defaultJsonStore) {
    this.store = store;
    this.collection = 'customers';
  }

  /**
   * Find a customer profile by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.store.findById(this.collection, id);
  }

  /**
   * Find all customer profiles matching an optional predicate.
   * @param {Function} [filterFn]
   * @returns {Promise<Array<object>>}
   */
  async findAll(filterFn) {
    return this.store.findAll(this.collection, filterFn);
  }

  /**
   * Find a customer profile by email (case-insensitive).
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const records = await this.store.findAll(
      this.collection,
      (c) => typeof c.email === 'string' && c.email.trim().toLowerCase() === normalized
    );
    return records.length > 0 ? records[0] : null;
  }

  /**
   * Create and persist a customer profile with serialized atomic writes.
   * @param {object} entity
   * @returns {Promise<object>}
   */
  async create(entity) {
    return this.store.create(this.collection, entity, 'usr');
  }

  /**
   * Partially or completely update an existing customer profile.
   * @param {string} id
   * @param {object} partialEntity
   * @returns {Promise<object|null>}
   */
  async update(id, partialEntity) {
    if (!id) return null;
    return this.store.update(this.collection, id, partialEntity);
  }

  /**
   * Delete a customer profile by ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!id) return false;
    return this.store.delete(this.collection, id);
  }
}

export const customerRepository = new CustomerRepository();
export default customerRepository;
