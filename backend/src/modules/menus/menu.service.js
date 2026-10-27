import defaultMenuRepository from './menu.repository.js';
import defaultRestaurantRepository from '../restaurants/restaurant.repository.js';
import {
    validateMenuItemCreate,
    validateMenuItemUpdate,
} from './menu.validation.js';

export class MenuService {
    /**
     * @param {import('./menu.repository.js').MenuRepository} [menuRepository]
     * @param {import('../restaurants/restaurant.repository.js').RestaurantRepository} [restaurantRepository]
     */
    constructor(
        menuRepository = defaultMenuRepository,
        restaurantRepository = defaultRestaurantRepository
    ) {
        this.menuRepository = menuRepository;
        this.restaurantRepository = restaurantRepository;
    }

    /**
     * Adds a new menu item to a restaurant.
     * Enforces that the authenticated user owns the target restaurant.
     *
     * @param {string} restaurantId
     * @param {string} ownerId
     * @param {object} data
     * @returns {Promise<object>}
     */
    async addMenuItem(restaurantId, ownerId, data) {
        if (!restaurantId) {
            const err = new Error('Restaurant ID is required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        if (!ownerId) {
            const err = new Error('Owner ID is required');
            err.statusCode = 401;
            err.code = 'UNAUTHORIZED';
            throw err;
        }

        // 1. Verify restaurant exists
        const restaurant = await this.restaurantRepository.findById(restaurantId);
        if (!restaurant) {
            const err = new Error(`Restaurant with ID '${restaurantId}' not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        // 2. Verify restaurant ownership
        if (restaurant.ownerId !== ownerId) {
            const err = new Error('Forbidden: You are not authorized to add menu items to this restaurant');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }

        // 3. Validate input payload using M3 validation
        const validation = validateMenuItemCreate(data);
        if (!validation.valid) {
            const err = new Error(validation.errors[0]?.message || 'Validation error');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            err.details = validation.errors;
            throw err;
        }

        // 4. Construct canonical MenuItem record
        const itemData = {
            restaurantId,
            name: data.name.trim(),
            description: data.description ? data.description.trim() : '',
            category: data.category.trim(),
            price: data.price,
            imageUrl: data.imageUrl || '',
            isAvailable: typeof data.isAvailable === 'boolean' ? data.isAvailable : true,
        };

        return this.menuRepository.create(itemData);
    }

    /**
     * Retrieves all menu items belonging to a restaurant.
     *
     * @param {string} restaurantId
     * @param {{ availableOnly?: boolean|string }} [options]
     * @returns {Promise<Array<object>>}
     */
    async getMenuItems(restaurantId, { availableOnly } = {}) {
        if (!restaurantId) {
            const err = new Error('Restaurant ID is required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        // 1. Verify restaurant exists
        const restaurant = await this.restaurantRepository.findById(restaurantId);
        if (!restaurant) {
            const err = new Error(`Restaurant with ID '${restaurantId}' not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        let items = await this.menuRepository.findByRestaurantId(restaurantId);

        if (availableOnly === 'true' || availableOnly === true) {
            items = items.filter((item) => item.isAvailable);
        }

        return items;
    }

    /**
     * Retrieves a single menu item by ID within a specific restaurant.
     *
     * @param {string} restaurantId
     * @param {string} itemId
     * @returns {Promise<object>}
     */
    async getMenuItemById(restaurantId, itemId) {
        if (!restaurantId || !itemId) {
            const err = new Error('Restaurant ID and Item ID are required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        const restaurant = await this.restaurantRepository.findById(restaurantId);
        if (!restaurant) {
            const err = new Error(`Restaurant with ID '${restaurantId}' not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        const item = await this.menuRepository.findById(itemId);
        if (!item || item.restaurantId !== restaurantId) {
            const err = new Error(`Menu item with ID '${itemId}' not found in restaurant '${restaurantId}'`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        return item;
    }

    /**
     * Updates an existing menu item.
     * Enforces restaurant ownership and item membership.
     *
     * @param {string} restaurantId
     * @param {string} itemId
     * @param {string} ownerId
     * @param {object} updateData
     * @returns {Promise<object>}
     */
    async updateMenuItem(restaurantId, itemId, ownerId, updateData) {
        if (!restaurantId || !itemId) {
            const err = new Error('Restaurant ID and Item ID are required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        // 1. Verify restaurant exists
        const restaurant = await this.restaurantRepository.findById(restaurantId);
        if (!restaurant) {
            const err = new Error(`Restaurant with ID '${restaurantId}' not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        // 2. Verify restaurant ownership
        if (restaurant.ownerId !== ownerId) {
            const err = new Error('Forbidden: You are not authorized to update menu items for this restaurant');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }

        // 3. Verify menu item exists and belongs to this restaurant
        const existing = await this.menuRepository.findById(itemId);
        if (!existing || existing.restaurantId !== restaurantId) {
            const err = new Error(`Menu item with ID '${itemId}' not found in restaurant '${restaurantId}'`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        // 4. Validate partial update payload
        const validation = validateMenuItemUpdate(updateData);
        if (!validation.valid) {
            const err = new Error(validation.errors[0]?.message || 'Validation error');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            err.details = validation.errors;
            throw err;
        }

        // 5. Sanitize updates to guarantee protected fields remain unmodified
        // eslint-disable-next-line no-unused-vars
        const { id: _id, restaurantId: _restaurantId, createdAt: _createdAt, updatedAt: _updatedAt, ...safeUpdates } = updateData;

        return this.menuRepository.update(itemId, safeUpdates);
    }

    /**
     * Toggles availability of a menu item.
     *
     * @param {string} restaurantId
     * @param {string} itemId
     * @param {string} ownerId
     * @param {boolean} isAvailable
     * @returns {Promise<object>}
     */
    async toggleAvailability(restaurantId, itemId, ownerId, isAvailable) {
        if (typeof isAvailable !== 'boolean') {
            const err = new Error("Field 'isAvailable' must be a boolean value");
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        return this.updateMenuItem(restaurantId, itemId, ownerId, { isAvailable });
    }

    /**
     * Deletes a menu item.
     * Enforces restaurant ownership and item membership.
     *
     * @param {string} restaurantId
     * @param {string} itemId
     * @param {string} ownerId
     * @returns {Promise<boolean>}
     */
    async deleteMenuItem(restaurantId, itemId, ownerId) {
        if (!restaurantId || !itemId) {
            const err = new Error('Restaurant ID and Item ID are required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        // 1. Verify restaurant exists
        const restaurant = await this.restaurantRepository.findById(restaurantId);
        if (!restaurant) {
            const err = new Error(`Restaurant with ID '${restaurantId}' not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        // 2. Verify restaurant ownership
        if (restaurant.ownerId !== ownerId) {
            const err = new Error('Forbidden: You are not authorized to delete menu items from this restaurant');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }

        // 3. Verify item exists and belongs to this restaurant
        const existing = await this.menuRepository.findById(itemId);
        if (!existing || existing.restaurantId !== restaurantId) {
            const err = new Error(`Menu item with ID '${itemId}' not found in restaurant '${restaurantId}'`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        return this.menuRepository.delete(itemId);
    }
}

const defaultMenuService = new MenuService();
export default defaultMenuService;