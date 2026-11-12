import { BaseRepository } from '../../utils/base.repository.js';

class MenuRepository extends BaseRepository {
  constructor() {
    super('menus.json', 'itemId');
  }

  /**
   * Find all menu items belonging to a given restaurant
   * @param {string} restaurantId
   * @returns {Promise<Array<Object>>}
   */
  async findByRestaurantId(restaurantId) {
    if (!restaurantId) return [];
    return this.findAll((item) => String(item.restaurantId) === String(restaurantId));
  }

  /**
   * Find specific menu items for a restaurant by item IDs
   * @param {string} restaurantId
   * @param {Array<string>} itemIds
   * @returns {Promise<Array<Object>>}
   */
  async findItemsByIds(restaurantId, itemIds) {
    if (!restaurantId || !Array.isArray(itemIds) || itemIds.length === 0) {
      return [];
    }
    const idsSet = new Set(itemIds.map(String));
    return this.findAll(
      (item) => String(item.restaurantId) === String(restaurantId) && idsSet.has(String(item.itemId))
    );
  }
}

export const menuRepository = new MenuRepository();
