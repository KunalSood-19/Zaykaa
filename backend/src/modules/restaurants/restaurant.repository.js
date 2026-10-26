import defaultJsonStore, { generateId } from '../../utils/jsonStore.js';

export class RestaurantRepository {
  /**
   * @param {import('../../utils/jsonStore.js').JsonStore} [store]
   */
  constructor(store = defaultJsonStore) {
    this.store = store;
    this.collection = 'restaurants';
  }

  /**
   * Finds a restaurant by its unique ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this.store.findById(this.collection, id);
  }

  /**
   * Finds a restaurant by its owner's user ID.
   * @param {string} ownerId
   * @returns {Promise<object|null>}
   */
  async findByOwnerId(ownerId) {
    if (!ownerId) return null;
    const restaurants = await this.store.findAll(
      this.collection,
      (r) => r.ownerId === ownerId
    );
    return restaurants.length > 0 ? restaurants[0] : null;
  }

  /**
   * Retrieves all restaurants matching an optional filter predicate.
   * @param {Function} [filterFn]
   * @returns {Promise<Array<object>>}
   */
  async findAll(filterFn) {
    return this.store.findAll(this.collection, filterFn);
  }

  /**
   * Atomically creates a restaurant while enforcing the one-restaurant-per-owner
   * constraint within the storage serialization queue to prevent race conditions.
   * @param {object} restaurantData
   * @returns {Promise<object>}
   */
  async createRestaurantWithUniqueOwner(restaurantData) {
    return this.store._serialize(this.collection, async () => {
      const restaurants = await this.store.readCollection(this.collection);
      const ownerId = restaurantData.ownerId;

      const existing = restaurants.find((r) => r.ownerId === ownerId);
      if (existing) {
        const err = new Error('Restaurant owner already has a registered restaurant');
        err.statusCode = 409;
        err.code = 'CONFLICT';
        throw err;
      }

      const now = new Date().toISOString();
      const newRestaurant = {
        id: generateId('rst'),
        ownerId,
        name: restaurantData.name.trim(),
        description: restaurantData.description ? restaurantData.description.trim() : '',
        cuisineTypes: restaurantData.cuisineTypes,
        address: restaurantData.address,
        phone: restaurantData.phone.trim(),
        imageUrl: restaurantData.imageUrl || '',
        isOpen: typeof restaurantData.isOpen === 'boolean' ? restaurantData.isOpen : true,
        createdAt: now,
        updatedAt: now,
      };

      restaurants.push(newRestaurant);
      await this.store._writeAtomic(this.collection, restaurants);
      return JSON.parse(JSON.stringify(newRestaurant));
    });
  }

  /**
   * Updates an existing restaurant by ID.
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object|null>}
   */
  async update(id, updateData) {
    return this.store.update(this.collection, id, updateData);
  }

  /**
   * Deletes a restaurant by ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return this.store.delete(this.collection, id);
  }
}

const defaultRestaurantRepository = new RestaurantRepository();
export default defaultRestaurantRepository;
