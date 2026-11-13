import defaultJsonStore from '../../utils/jsonStore.js';

export class MenuRepository {
  /**
   * @param {import('../../utils/jsonStore.js').JsonStore} [store]
   */
  constructor(store = defaultJsonStore) {
    this.store = store;
    this.collection = 'menus';
  }

  /**
   * Finds a menu item by its unique ID (supports both canonical `id` and legacy `itemId`).
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const items = await this.store.findAll(
      this.collection,
      (item) => String(item.id) === String(id) || String(item.itemId) === String(id)
    );
    return items.length > 0 ? items[0] : null;
  }

  /**
   * Retrieves all menu items belonging to a specific restaurant.
   * @param {string} restaurantId
   * @returns {Promise<Array<object>>}
   */
  async findByRestaurantId(restaurantId) {
    if (!restaurantId) return [];
    return this.store.findAll(
      this.collection,
      (item) => String(item.restaurantId) === String(restaurantId)
    );
  }

  /**
   * Finds specific menu items for a restaurant by item IDs (`id` or `itemId`).
   * @param {string} restaurantId
   * @param {Array<string>} itemIds
   * @returns {Promise<Array<object>>}
   */
  async findItemsByIds(restaurantId, itemIds) {
    if (!restaurantId || !Array.isArray(itemIds) || itemIds.length === 0) {
      return [];
    }
    const idsSet = new Set(itemIds.map(String));
    return this.store.findAll(
      this.collection,
      (item) =>
        String(item.restaurantId) === String(restaurantId) &&
        (idsSet.has(String(item.id)) || idsSet.has(String(item.itemId)))
    );
  }

  /**
   * Retrieves all menu items matching an optional filter predicate.
   * @param {Function} [filterFn]
   * @returns {Promise<Array<object>>}
   */
  async findAll(filterFn) {
    return this.store.findAll(this.collection, filterFn);
  }

  /**
   * Persists a new menu item with prefix 'item_' and timestamps.
   * @param {object} itemData
   * @returns {Promise<object>}
   */
  async create(itemData) {
    return this.store.create(this.collection, itemData, 'item');
  }

  /**
   * Updates an existing menu item by ID.
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object|null>}
   */
  async update(id, updateData) {
    return this.store.update(this.collection, id, updateData);
  }

  /**
   * Deletes a menu item by ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return this.store.delete(this.collection, id);
  }
}

const defaultMenuRepository = new MenuRepository();
export const menuRepository = defaultMenuRepository;
export default defaultMenuRepository;
