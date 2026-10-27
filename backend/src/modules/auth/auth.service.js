import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readJson, writeJson } from '../../utils/jsonStorage.js';
import { ApiError } from '../../utils/apiError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'zaykaa_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
  constructor() {
    this.usersFile = 'users.json';
    this.customersFile = 'customers.json';
  }

  /**
   * Register a new user
   */
  async register({ name, email, password, phone, role = 'customer' }) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw ApiError.badRequest('Name is required', 'VALIDATION_ERROR');
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw ApiError.badRequest('A valid email address is required', 'VALIDATION_ERROR');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long', 'VALIDATION_ERROR');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await readJson(this.usersFile);

    const existingUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existingUser) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = role === 'customer'
      ? `cust_${Math.floor(1000 + Math.random() * 9000)}`
      : role === 'restaurant'
      ? `rest_user_${Math.floor(1000 + Math.random() * 9000)}`
      : `del_user_${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : '',
      role,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeJson(this.usersFile, users);

    // If customer, also synchronize with customers.json profile collection
    if (role === 'customer') {
      const customers = await readJson(this.customersFile);
      const existingCustomer = customers.find((c) => c.id === userId);
      if (!existingCustomer) {
        customers.push({
          id: userId,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          addresses: [],
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        });
        await writeJson(this.customersFile, customers);
      }
    }

    const token = this.generateToken(newUser);

    return {
      token,
      user: this.sanitizeUser(newUser)
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required', 'VALIDATION_ERROR');
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await readJson(this.usersFile);

    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = this.generateToken(user);

    return {
      token,
      user: this.sanitizeUser(user)
    };
  }

  /**
   * Get current user profile by ID
   */
  async getMe(userId) {
    if (!userId) {
      throw ApiError.badRequest('User ID is required', 'VALIDATION_ERROR');
    }

    const users = await readJson(this.usersFile);
    const user = users.find((u) => u.id === userId);

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Sign JWT token with user payload
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        ...(user.restaurantId ? { restaurantId: user.restaurantId } : {}),
        ...(user.partnerId ? { partnerId: user.partnerId } : {})
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify a JWT token
   */
  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  /**
   * Strip sensitive fields from user entity
   */
  sanitizeUser(user) {
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}

export const authService = new AuthService();
