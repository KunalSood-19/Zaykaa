import { restaurantRepository } from './restaurant.repository.js';
import { ApiError } from '../../utils/apiError.js';

class RestaurantService {
  /**
   * List restaurants with search, cuisine filter, veg filter, sorting, and pagination
   */
  async listRestaurants({ search, cuisine, isVeg, sortBy = 'rating', page = 1, limit = 10 } = {}) {
    const allRestaurants = await restaurantRepository.findAll();

    let filtered = allRestaurants;

    // Filter by search string (matches name or any cuisine tag)
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((r) => {
        const nameMatch = r.name && r.name.toLowerCase().includes(q);
        const cuisineMatch = Array.isArray(r.cuisines) && r.cuisines.some((c) => c.toLowerCase().includes(q));
        return nameMatch || cuisineMatch;
      });
    }

    // Filter by specific cuisine
    if (cuisine && typeof cuisine === 'string' && cuisine.trim()) {
      const cQuery = cuisine.trim().toLowerCase();
      filtered = filtered.filter(
        (r) => Array.isArray(r.cuisines) && r.cuisines.some((c) => c.toLowerCase() === cQuery)
      );
    }

    // Filter by vegetarian
    if (isVeg !== undefined && isVeg !== null && isVeg !== '') {
      const isVegBool = isVeg === true || isVeg === 'true' || isVeg === '1';
      if (isVegBool) {
        filtered = filtered.filter((r) => Boolean(r.isVegOnly));
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'deliveryTime') {
        const timeA = a.deliveryTimeMinutes || 30;
        const timeB = b.deliveryTimeMinutes || 30;
        return timeA - timeB;
      }
      if (sortBy === 'costForTwo') {
        return (a.costForTwo || 0) - (b.costForTwo || 0);
      }
      // Default: rating descending
      return (b.rating || 0) - (a.rating || 0);
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const total = filtered.length;
    const startIndex = (parsedPage - 1) * parsedLimit;
    const items = filtered.slice(startIndex, startIndex + parsedLimit);

    return {
      restaurants: items,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total
      }
    };
  }

  /**
   * Retrieve single restaurant details by ID
   */
  async getRestaurantById(id) {
    if (!id || typeof id !== 'string') {
      throw ApiError.badRequest('A valid restaurant ID is required', 'VALIDATION_ERROR');
    }

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      throw ApiError.notFound(`Restaurant with ID '${id}' was not found`, 'RESTAURANT_NOT_FOUND');
    }

    return restaurant;
  }
}

export const restaurantService = new RestaurantService();
