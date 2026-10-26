import defaultJsonStore, { generateId } from '../../utils/jsonStore.js';

export class AuthRepository {
  /**
   * @param {import('../../utils/jsonStore.js').JsonStore} [store]
   */
  constructor(store = defaultJsonStore) {
    this.store = store;
    this.collection = 'users';
  }

  /**
   * Finds a user by email (case-insensitive).
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const users = await this.store.findAll(
      this.collection,
      (u) => typeof u.email === 'string' && u.email.toLowerCase() === normalized
    );
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Finds a user by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return this.store.findById(this.collection, id);
  }

  /**
   * Creates a new user record.
   * @param {object} userData
   * @returns {Promise<object>}
   */
  async create(userData) {
    return this.store.create(this.collection, userData, 'usr');
  }

  /**
   * Atomically checks for duplicate email and creates a new user record
   * within the storage serialization queue to prevent race conditions.
   * @param {object} userData
   * @returns {Promise<object>}
   */
  async createUserWithUniqueEmail(userData) {
    return this.store._serialize(this.collection, async () => {
      const users = await this.store.readCollection(this.collection);
      const normalizedEmail = userData.email.trim().toLowerCase();

      const exists = users.some(
        (u) => typeof u.email === 'string' && u.email.trim().toLowerCase() === normalizedEmail
      );

      if (exists) {
        const err = new Error('An account with this email address already exists');
        err.statusCode = 409;
        err.code = 'CONFLICT';
        throw err;
      }

      const now = new Date().toISOString();
      const newRecord = {
        id: userData.id || generateId('usr'),
        ...userData,
        email: normalizedEmail,
        createdAt: userData.createdAt || now,
        updatedAt: now,
      };

      users.push(newRecord);
      await this.store._writeAtomic(this.collection, users);
      return JSON.parse(JSON.stringify(newRecord));
    });
  }
}

const defaultAuthRepository = new AuthRepository();
export default defaultAuthRepository;
