import defaultJsonStore from '../../utils/jsonStore.js';

export class OrderRepository {
  /**
   * @param {import('../../utils/jsonStore.js').JsonStore} [store]
   */
  constructor(store = defaultJsonStore) {
    this.store = store;
    this.collection = 'orders';
  }

  /**
   * Finds a single order by its unique ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.store.findById(this.collection, id);
  }

  /**
   * Finds all orders fulfilling a specific restaurant ID.
   * @param {string} restaurantId
   * @returns {Promise<Array<object>>}
   */
  async findByRestaurantId(restaurantId) {
    if (!restaurantId) return [];
    return this.store.findAll(
      this.collection,
      (order) => order.restaurantId === restaurantId
    );
  }

  /**
   * Retrieves all orders matching an optional filter predicate.
   * @param {Function} [filterFn]
   * @returns {Promise<Array<object>>}
   */
  async findAll(filterFn) {
    return this.store.findAll(this.collection, filterFn);
  }

  /**
   * Persists a new order record (used for seed fixtures and shared integration).
   * @param {object} orderData
   * @returns {Promise<object>}
   */
  async create(orderData) {
    const now = new Date().toISOString();
    const dataWithTimestamps = {
      ...orderData,
      timestamps: {
        createdAt: orderData.timestamps?.createdAt || now,
        updatedAt: now,
      },
    };
    return this.store.create(this.collection, dataWithTimestamps, 'ord');
  }

  /**
   * Updates an existing order record.
   * Preserves immutable fields (id, customerId, restaurantId, items, pricing, etc.).
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object|null>}
   */
  async update(id, updateData) {
    const now = new Date().toISOString();
    return this.store._serialize(this.collection, async () => {
      const orders = await this.store.readCollection(this.collection);
      const index = orders.findIndex((o) => o.id === id);
      if (index === -1) return null;

      const existing = orders[index];
      const updated = {
        ...existing,
        ...updateData,
        id: existing.id,
        customerId: existing.customerId,
        restaurantId: existing.restaurantId,
        createdAt: existing.createdAt,
        updatedAt: now,
        timestamps: {
          createdAt: existing.timestamps?.createdAt || existing.createdAt || now,
          updatedAt: now,
        },
      };

      orders[index] = updated;
      await this.store._writeAtomic(this.collection, orders);
      return JSON.parse(JSON.stringify(updated));
    });
  }

  /**
   * Deletes an order record by ID (for test cleanup).
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return this.store.delete(this.collection, id);
  }
}

const defaultOrderRepository = new OrderRepository();
export default defaultOrderRepository;
