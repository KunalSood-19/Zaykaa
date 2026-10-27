import defaultJsonStore, { generateId } from '../../utils/jsonStore.js';

export class DeliveryRepository {
  /**
   * @param {import('../../utils/jsonStore.js').JsonStore} [store]
   */
  constructor(store = defaultJsonStore) {
    this.store = store;
    this.collection = 'delivery_partners';
  }

  /**
   * Finds a delivery partner by their unique ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.store.findById(this.collection, id);
  }

  /**
   * Finds a delivery partner by their user ID.
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async findByUserId(userId) {
    if (!userId) return null;
    const partners = await this.store.findAll(
      this.collection,
      (p) => p.userId === userId
    );
    return partners.length > 0 ? partners[0] : null;
  }

  /**
   * Retrieves all delivery partners matching an optional filter predicate.
   * @param {Function} [filterFn]
   * @returns {Promise<Array<object>>}
   */
  async findAll(filterFn) {
    return this.store.findAll(this.collection, filterFn);
  }

  /**
   * Atomically creates a delivery partner profile while enforcing
   * the 1:1 user-to-partner constraint within the storage serialization queue.
   * @param {object} partnerData
   * @returns {Promise<object>}
   */
  async createPartnerWithUniqueUser(partnerData) {
    return this.store._serialize(this.collection, async () => {
      const partners = await this.store.readCollection(this.collection);
      const userId = partnerData.userId;

      const existing = partners.find((p) => p.userId === userId);
      if (existing) {
        const err = new Error('Delivery partner profile already exists for this user');
        err.statusCode = 409;
        err.code = 'CONFLICT';
        throw err;
      }

      const now = new Date().toISOString();
      const newPartner = {
        id: generateId('del'),
        userId,
        vehicleType: partnerData.vehicleType.trim(),
        isAvailable:
          typeof partnerData.isAvailable === 'boolean'
            ? partnerData.isAvailable
            : false,
        activeOrderId: null,
        totalDeliveries: 0,
        createdAt: now,
        updatedAt: now,
      };

      partners.push(newPartner);
      await this.store._writeAtomic(this.collection, partners);
      return JSON.parse(JSON.stringify(newPartner));
    });
  }

  /**
   * Updates an existing delivery partner profile by ID.
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object|null>}
   */
  async update(id, updateData) {
    return this.store.update(this.collection, id, updateData);
  }

  /**
   * Deletes a delivery partner profile by ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return this.store.delete(this.collection, id);
  }
}

const defaultDeliveryRepository = new DeliveryRepository();
export default defaultDeliveryRepository;
