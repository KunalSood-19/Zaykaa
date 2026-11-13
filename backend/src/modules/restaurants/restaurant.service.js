import defaultRestaurantRepository from './restaurant.repository.js';
import {
  validateRestaurantCreate,
  validateRestaurantUpdate,
} from './restaurant.validation.js';

export class RestaurantService {
  /**
   * @param {import('./restaurant.repository.js').RestaurantRepository} [repository]
   */
  constructor(repository = defaultRestaurantRepository) {
    this.repository = repository;
  }

  /**
   * Creates a restaurant profile for an authenticated owner.
   * Enforces that the user has role 'restaurant' and does not already own a restaurant.
   * @param {string} ownerId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createRestaurant(ownerId, data) {
    if (!ownerId) {
      const err = new Error('Owner ID is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // 1. Validation
    const validation = validateRestaurantCreate(data);
    if (!validation.valid) {
      const err = new Error(validation.errors[0]?.message || 'Validation error');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = validation.errors;
      throw err;
    }

    // 2. Check if owner already has a restaurant (fast check before repository serialization)
    const existing = await this.repository.findByOwnerId(ownerId);
    if (existing) {
      const err = new Error('Restaurant owner already has a registered restaurant');
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }

    // 3. Atomically create via repository with concurrency mutex
    return this.repository.createRestaurantWithUniqueOwner({
      ...data,
      ownerId,
    });
  }

  /**
   * Lists restaurants with optional search, cuisine, vegetarian, sorting, and pagination filters.
   * Supports both M2 (`cuisineTypes`) and M1 (`cuisines`, `isVeg`, `sortBy`, `page`, `limit`) schemas.
   * @param {object} [filters]
   * @returns {Promise<Array<object>>}
   */
  async getRestaurants(filters = {}) {
    const { restaurants } = await this.listRestaurants(filters);
    return restaurants;
  }

  /**
   * Customer-compatible discovery listing returning paginated items and metadata.
   * Preserves all records when page/limit are not provided.
   * @param {object} [filters]
   * @returns {Promise<{ restaurants: Array<object>, meta: { page: number, limit: number, total: number } }>}
   */
  async listRestaurants({ search, cuisine, isVeg, sortBy, page, limit } = {}) {
    const searchLower = typeof search === 'string' && search.trim() ? search.trim().toLowerCase() : null;
    const cuisineLower = typeof cuisine === 'string' && cuisine.trim() ? cuisine.trim().toLowerCase() : null;
    const filterVeg = isVeg === true || isVeg === 'true' || isVeg === '1';

    const filtered = await this.repository.findAll((restaurant) => {
      const tags = Array.isArray(restaurant.cuisineTypes)
        ? restaurant.cuisineTypes
        : Array.isArray(restaurant.cuisines)
        ? restaurant.cuisines
        : [];

      // Search filter matches name, description, or cuisine tags (case-insensitive substring)
      if (searchLower) {
        const nameMatch = restaurant.name?.toLowerCase().includes(searchLower);
        const descMatch = restaurant.description?.toLowerCase().includes(searchLower);
        const tagMatch = tags.some((c) => typeof c === 'string' && c.toLowerCase().includes(searchLower));
        if (!nameMatch && !descMatch && !tagMatch) {
          return false;
        }
      }

      // Cuisine filter matches any element in cuisineTypes or cuisines
      if (cuisineLower && cuisineLower !== 'all') {
        const hasCuisine = tags.some(
          (c) =>
            typeof c === 'string' &&
            (c.toLowerCase() === cuisineLower || c.toLowerCase().includes(cuisineLower))
        );
        if (!hasCuisine) {
          return false;
        }
      }

      // Vegetarian filter (if requested)
      if (filterVeg && !restaurant.isVegOnly) {
        return false;
      }

      return true;
    });

    if (sortBy) {
      filtered.sort((a, b) => {
        if (sortBy === 'deliveryTime') {
          return (a.deliveryTimeMinutes || 30) - (b.deliveryTimeMinutes || 30);
        }
        if (sortBy === 'costForTwo') {
          return (a.costForTwo || 0) - (b.costForTwo || 0);
        }
        // 'rating' or default sortBy
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    const total = filtered.length;
    const hasPagination = page !== undefined || limit !== undefined;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = hasPagination
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 10))
      : Math.max(total, 10);

    const items = hasPagination
      ? filtered.slice((parsedPage - 1) * parsedLimit, (parsedPage - 1) * parsedLimit + parsedLimit)
      : filtered;

    return {
      restaurants: items,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
      },
    };
  }

  /**
   * Gets a restaurant by its unique ID.
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getRestaurantById(id) {
    if (!id || typeof id !== 'string') {
      const err = new Error('Restaurant ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const restaurant = await this.repository.findById(id);
    if (!restaurant) {
      const err = new Error(`Restaurant with ID '${id}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return restaurant;
  }

  /**
   * Gets the authenticated owner's restaurant profile.
   * @param {string} ownerId
   * @returns {Promise<object>}
   */
  async getMyRestaurant(ownerId) {
    if (!ownerId) {
      const err = new Error('Owner ID is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const restaurant = await this.repository.findByOwnerId(ownerId);
    if (!restaurant) {
      const err = new Error('No restaurant profile found for current user');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return restaurant;
  }

  /**
   * Updates an existing restaurant profile.
   * Enforces that the caller is the restaurant's owner.
   * @param {string} id
   * @param {string} ownerId
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateRestaurant(id, ownerId, updateData) {
    if (!id) {
      const err = new Error('Restaurant ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // 1. Validate update payload
    const validation = validateRestaurantUpdate(updateData);
    if (!validation.valid) {
      const err = new Error(validation.errors[0]?.message || 'Validation error');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = validation.errors;
      throw err;
    }

    // 2. Fetch existing restaurant
    const existing = await this.repository.findById(id);
    if (!existing) {
      const err = new Error(`Restaurant with ID '${id}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 3. Ownership verification
    if (existing.ownerId !== ownerId) {
      const err = new Error('Forbidden: You are not authorized to update this restaurant');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // 4. Sanitize updates to guarantee protected fields remain untouched
    // eslint-disable-next-line no-unused-vars
    const { id: _id, ownerId: _ownerId, createdAt: _createdAt, updatedAt: _updatedAt, ...safeUpdates } = updateData;

    // Deep merge address if provided
    if (safeUpdates.address && typeof safeUpdates.address === 'object' && !Array.isArray(safeUpdates.address)) {
      safeUpdates.address = {
        ...existing.address,
        ...safeUpdates.address,
      };
    }

    return this.repository.update(id, {
      ...safeUpdates,
      ownerId: existing.ownerId,
    });
  }

  /**
   * Deletes a restaurant profile.
   * Enforces that the caller is the restaurant's owner.
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<boolean>}
   */
  async deleteRestaurant(id, ownerId) {
    if (!id) {
      const err = new Error('Restaurant ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      const err = new Error(`Restaurant with ID '${id}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (existing.ownerId !== ownerId) {
      const err = new Error('Forbidden: You are not authorized to delete this restaurant');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    return this.repository.delete(id);
  }
}

const defaultRestaurantService = new RestaurantService();
export const restaurantService = defaultRestaurantService;
export default defaultRestaurantService;
