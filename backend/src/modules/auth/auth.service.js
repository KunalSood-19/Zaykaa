import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import defaultAuthRepository from './auth.repository.js';
import { getJwtSecret, JWT_EXPIRES_IN } from '../../config/jwt.config.js';

const ALLOWED_ROLES = ['customer', 'restaurant', 'delivery'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  /**
   * @param {import('./auth.repository.js').AuthRepository} [repository]
   */
  constructor(repository = defaultAuthRepository) {
    this.repository = repository;
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

    // 3. Concurrency-safe atomic uniqueness verification & creation
    const createdUser = await this.repository.createUserWithUniqueEmail({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone.trim(),
      role: role.trim(),
    });

    // 4. JWT Generation
    const token = this._generateToken(createdUser);

    // 5. Safe user payload (never leak passwordHash)
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
   * Signs a JWT with safe identity claims.
   * @private
   */
  _generateToken(user) {
    const secret = getJwtSecret();
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
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

const defaultAuthService = new AuthService();
export default defaultAuthService;
