import { menuRepository } from './menu.repository.js';
import { restaurantRepository } from '../restaurants/restaurant.repository.js';
import { ApiError } from '../../utils/apiError.js';

class MenuService {
  /**
   * Fetch and group menu items by category for a restaurant
   */
  async getMenuByRestaurantId(restaurantId, { category, isVeg, availableOnly = true } = {}) {
    if (!restaurantId || typeof restaurantId !== 'string') {
      throw ApiError.badRequest('A valid restaurant ID is required', 'VALIDATION_ERROR');
    }

    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw ApiError.notFound(`Restaurant with ID '${restaurantId}' was not found`, 'RESTAURANT_NOT_FOUND');
    }

    const allItems = await menuRepository.findByRestaurantId(restaurantId);

    let filtered = allItems;

    // Filter by availability (default true for customer view)
    const isAvailableFilter = availableOnly === true || availableOnly === 'true' || availableOnly === undefined;
    if (isAvailableFilter && String(availableOnly) !== 'false') {
      filtered = filtered.filter((item) => item.isAvailable === true);
    }

    // Filter by category
    if (category && typeof category === 'string' && category.trim()) {
      const catQuery = category.trim().toLowerCase();
      filtered = filtered.filter((item) => item.category && item.category.toLowerCase() === catQuery);
    }

    // Filter by vegetarian
    if (isVeg !== undefined && isVeg !== null && isVeg !== '') {
      const isVegBool = isVeg === true || isVeg === 'true' || isVeg === '1';
      if (isVegBool) {
        filtered = filtered.filter((item) => Boolean(item.isVeg));
      }
    }

    // Group items into categories
    const categoryMap = new Map();
    for (const item of filtered) {
      const catName = item.category || 'Specialties';
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, []);
      }
      categoryMap.get(catName).push(item);
    }

    const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
      name,
      items
    }));

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      categories
    };
  }
}

export const menuService = new MenuService();
