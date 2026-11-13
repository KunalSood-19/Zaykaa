import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import defaultAuthRepository from './auth.repository.js';
import { customerRepository } from '../customers/customer.repository.js';
import { generateId } from '../../utils/jsonStore.js';
import { getJwtSecret, JWT_EXPIRES_IN } from '../../config/jwt.config.js';

const ALLOWED_ROLES = ['customer', 'restaurant', 'delivery'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  /**
   * @param {import('./auth.repository.js').AuthRepository} [repository]
   * @param {{ findById?: Function, create: Function }} [customerRepo]
   */
  constructor(repository = defaultAuthRepository, customerRepo = customerRepository) {
    this.repository = repository;
    this.customerRepository = customerRepo;
  }

  /**
   * Registers a new platform user with concurrency-safe uniqueness checks.
   * @param {object} input
   * @returns {Promise<{ user: object, token: string }>}
   */
  async register({ name, email, password, phone, role }) {
    // 1. Field presence validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      const err = new Error("Field 'name' is required (2-80 characters)");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (name.trim().length < 2 || name.trim().length > 80) {
      const err = new Error("Field 'name' must be between 2 and 80 characters");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      const err = new Error("Field 'email' is required");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      const err = new Error('Invalid email format');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!password || typeof password !== 'string') {
      const err = new Error("Field 'password' is required");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (password.length < 8) {
      const err = new Error('Password must be at least 8 characters long');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      const err = new Error("Field 'phone' is required");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!role || typeof role !== 'string' || !ALLOWED_ROLES.includes(role.trim())) {
      const err = new Error(`Invalid role '${role}'. Allowed roles: ${ALLOWED_ROLES.join(', ')}`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // 2. Password hashing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const trimmedRole = role.trim();
    const userPayload = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone.trim(),
      role: trimmedRole,
    };

    // 3. Concurrency-safe atomic creation (coordinates users + customers via shared JsonStore when available)
    const canCoordinateAtomically =
      trimmedRole === 'customer' &&
      this.repository?.store &&
      this.customerRepository?.store === this.repository.store &&
      typeof this.repository.store._serializeMulti === 'function';

    let createdUser;
    if (canCoordinateAtomically) {
      createdUser = await this._registerCustomerAtomically(userPayload);
    } else {
      createdUser = await this.repository.createUserWithUniqueEmail(userPayload);

      // 4. Create a matching Customer profile when an external/injected customer repository is used
      if (createdUser.role === 'customer') {
        try {
          const existingProfile =
            typeof this.customerRepository?.findById === 'function'
              ? await this.customerRepository.findById(createdUser.id)
              : null;

          if (!existingProfile) {
            await this.customerRepository.create({
              id: createdUser.id,
              name: createdUser.name,
              email: createdUser.email,
              phone: createdUser.phone,
              addresses: [],
            });
          }
        } catch (profileErr) {
          const err = new Error(
            `User '${createdUser.id}' was created, but failed to initialize customer profile: ${profileErr.message}`
          );
          err.statusCode = profileErr.statusCode || 500;
          err.code = 'CUSTOMER_PROFILE_CREATION_FAILED';
          err.userId = createdUser.id;
          err.cause = profileErr;
          throw err;
        }
      }
    }

    // 5. JWT Generation
    const token = this._generateToken(createdUser);

    // 6. Safe user payload (never leak passwordHash)
    const safeUser = this._sanitizeUser(createdUser);

    return { user: safeUser, token };
  }

  /**
   * Authenticates a user and issues a JWT token.
   * @param {object} input
   * @returns {Promise<{ user: object, token: string }>}
   */
  async login({ email, password }) {
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.repository.findByEmail(normalizedEmail);

    // Generic error message for both non-existent user and wrong password
    const authFailedError = () => {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      return err;
    };

    if (!user) {
      throw authFailedError();
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw authFailedError();
    }

    const token = this._generateToken(user);
    const safeUser = this._sanitizeUser(user);

    return { user: safeUser, token };
  }

  /**
   * Retrieves sanitized profile for an authenticated user.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getMe(userId) {
    if (!userId) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      const err = new Error('User account no longer exists');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return this._sanitizeUser(user);
  }

  /**
   * Coordinates atomic user and customer profile creation across shared JsonStore locks.
   * Rolls back the user write while still holding both locks if customer write fails.
   * @private
   */
  async _registerCustomerAtomically(userData) {
    const store = this.repository.store;
    const usersCol = this.repository.collection || 'users';
    const customersCol = this.customerRepository.collection || 'customers';

    return store._serializeMulti([usersCol, customersCol], async () => {
      const users = await store.readCollection(usersCol);
      const exists = users.some(
        (u) => typeof u.email === 'string' && u.email.trim().toLowerCase() === userData.email
      );

      if (exists) {
        const err = new Error('An account with this email address already exists');
        err.statusCode = 409;
        err.code = 'CONFLICT';
        throw err;
      }

      let customers;
      try {
        customers = await store.readCollection(customersCol);
      } catch (readErr) {
        const err = new Error(
          `Customer registration aborted before saving user due to profile store error: ${readErr.message}`
        );
        err.statusCode = readErr.statusCode || 500;
        err.code = 'CUSTOMER_PROFILE_CREATION_FAILED';
        err.rollbackSucceeded = true;
        err.cause = readErr;
        throw err;
      }

      const now = new Date().toISOString();
      const userId = generateId('usr');
      const newUser = {
        id: userId,
        ...userData,
        createdAt: now,
        updatedAt: now,
      };
      const newCustomer = {
        id: userId,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        addresses: [],
        createdAt: now,
        updatedAt: now,
      };

      const nextUsers = [...users, newUser];
      const nextCustomers = [...customers.filter((c) => c.id !== userId), newCustomer];

      await store._writeAtomic(usersCol, nextUsers);
      try {
        await store._writeAtomic(customersCol, nextCustomers);
      } catch (profileErr) {
        let rollbackSucceeded = false;
        try {
          await store._writeAtomic(usersCol, users);
          rollbackSucceeded = true;
        } catch {
          rollbackSucceeded = false;
        }
        const err = new Error(
          rollbackSucceeded
            ? `Customer registration rolled back after profile creation failure: ${profileErr.message}`
            : `User '${userId}' was created, but failed to initialize customer profile: ${profileErr.message}`
        );
        err.statusCode = profileErr.statusCode || 500;
        err.code = 'CUSTOMER_PROFILE_CREATION_FAILED';
        err.userId = userId;
        err.rollbackSucceeded = rollbackSucceeded;
        err.cause = profileErr;
        throw err;
      }

      return JSON.parse(JSON.stringify(newUser));
    });
  }

  /**
   * Signs a JWT with safe identity claims.
   * @private
   */
  _generateToken(user) {
    const secret = getJwtSecret();
    const payload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.restaurantId ? { restaurantId: user.restaurantId } : {}),
      ...(user.partnerId ? { partnerId: user.partnerId } : {}),
    };

    return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Strips passwordHash and internal secrets from user entity.
   * @private
   */
  _sanitizeUser(user) {
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}

export const authService = new AuthService();
export default authService;
