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
     * Finds a menu item by its unique ID.
     * @param {string} id
     * @returns {Promise<object|null>}
     */
    async findById(id) {
        if (!id) return null;
        return this.store.findById(this.collection, id);
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
            (item) => item.restaurantId === restaurantId
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
export default defaultMenuRepository;