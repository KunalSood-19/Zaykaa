import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import { JsonStore } from '../src/utils/jsonStore.js';
import { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { createAuthMiddleware } from '../src/middleware/auth.middleware.js';

// Ensure JWT_SECRET is set for testing
process.env.JWT_SECRET = 'test_jwt_secret_key_for_unit_tests_1234567890';
process.env.JWT_EXPIRES_IN = '24h';

// Helper to create mock Express response
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

describe('Authentication Module Tests (Prompt 1.3A & 1.3B)', () => {
  let tempDir;
  let isolatedStore;
  let authRepository;
  let authService;
  let authController;
  let authMiddleware;

  beforeEach(async () => {
    // Create an isolated temporary directory for test users collection
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-auth-test-'));
    isolatedStore = new JsonStore(tempDir);
    authRepository = new AuthRepository(isolatedStore);
    authService = new AuthService(authRepository);
    authController = new AuthController(authService);
    authMiddleware = createAuthMiddleware(authRepository);
  });

  afterEach(async () => {
    // Clean up temporary test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // --- Registration Tests ---

  test('1. Successful customer registration creates user and returns safe payload with token', async () => {
    const payload = {
      name: 'Kunal Sood',
      email: 'kunal@example.com',
      password: 'StrongPassword123!',
      phone: '+91 98765 43210',
      role: 'customer',
    };

    const result = await authService.register(payload);
    assert.ok(result.user);
    assert.ok(result.token);
    assert.ok(result.user.id.startsWith('usr_'));
    assert.equal(result.user.name, 'Kunal Sood');
    assert.equal(result.user.email, 'kunal@example.com');
    assert.equal(result.user.role, 'customer');
    assert.equal(result.user.passwordHash, undefined);
  });

  test('2. Successful restaurant registration creates user with restaurant role', async () => {
    const payload = {
      name: 'Spice Symphony Owner',
      email: 'owner@spicesymphony.com',
      password: 'RestaurantPass123!',
      phone: '+91 80 4123 4567',
      role: 'restaurant',
    };

    const result = await authService.register(payload);
    assert.equal(result.user.role, 'restaurant');
    assert.equal(result.user.email, 'owner@spicesymphony.com');
  });

  test('3. Successful delivery partner registration creates user with delivery role', async () => {
    const payload = {
      name: 'Rider Ramesh',
      email: 'ramesh.delivery@example.com',
      password: 'DeliveryPass123!',
      phone: '+91 91234 56789',
      role: 'delivery',
    };

    const result = await authService.register(payload);
    assert.equal(result.user.role, 'delivery');
    assert.equal(result.user.email, 'ramesh.delivery@example.com');
  });

  test('4. Duplicate email registration is rejected case-insensitively', async () => {
    await authService.register({
      name: 'User One',
      email: 'duplicate@example.com',
      password: 'Password123!',
      phone: '+91 98765 43210',
      role: 'customer',
    });

    await assert.rejects(
      async () => {
        await authService.register({
          name: 'User Two',
          email: 'DUPLICATE@EXAMPLE.COM',
          password: 'Password123!',
          phone: '+91 98765 43211',
          role: 'customer',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'CONFLICT');
        return true;
      }
    );
  });

  test('5. Invalid email format is rejected with validation error', async () => {
    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Invalid Email User',
          email: 'not-an-email-at-all',
          password: 'Password123!',
          phone: '+91 98765 43210',
          role: 'customer',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /invalid email/i);
        return true;
      }
    );
  });

  test('6. Weak password (< 8 characters) is rejected with validation error', async () => {
    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Short Password User',
          email: 'shortpass@example.com',
          password: 'short',
          phone: '+91 98765 43210',
          role: 'customer',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /at least 8 characters/i);
        return true;
      }
    );
  });

  test('7. Invalid role is rejected with validation error', async () => {
    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Super Admin',
          email: 'admin@example.com',
          password: 'Password123!',
          phone: '+91 98765 43210',
          role: 'administrator', // invalid
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /invalid role/i);
        return true;
      }
    );
  });

  // --- Login Tests ---

  test('8. Successful login authenticates valid credentials and returns token', async () => {
    await authService.register({
      name: 'Valid Login User',
      email: 'validlogin@example.com',
      password: 'SecretPassword123!',
      phone: '+91 98765 43210',
      role: 'customer',
    });

    const loginResult = await authService.login({
      email: 'VALIDLOGIN@EXAMPLE.COM',
      password: 'SecretPassword123!',
    });

    assert.ok(loginResult.user);
    assert.ok(loginResult.token);
    assert.equal(loginResult.user.email, 'validlogin@example.com');
    assert.equal(loginResult.user.passwordHash, undefined);
  });

  test('9. Incorrect password rejection returns generic 401 Unauthorized error', async () => {
    await authService.register({
      name: 'Wrong Pass User',
      email: 'wrongpass@example.com',
      password: 'CorrectPassword123!',
      phone: '+91 98765 43210',
      role: 'customer',
    });

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'wrongpass@example.com',
          password: 'IncorrectPassword!',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        assert.equal(err.message, 'Invalid email or password');
        return true;
      }
    );
  });

  test('10. Password hash never appears in registration or login response', async () => {
    const regResult = await authService.register({
      name: 'Safe User',
      email: 'safeuser@example.com',
      password: 'SafePassword123!',
      phone: '+91 98765 43210',
      role: 'customer',
    });

    assert.equal('passwordHash' in regResult.user, false);
    assert.equal('password' in regResult.user, false);

    const loginResult = await authService.login({
      email: 'safeuser@example.com',
      password: 'SafePassword123!',
    });

    assert.equal('passwordHash' in loginResult.user, false);
    assert.equal('password' in loginResult.user, false);
  });

  test('11. Password is stored as a bcrypt hash on disk and not plaintext', async () => {
    const plaintext = 'MySecretPlaintextPassword123!';
    const regResult = await authService.register({
      name: 'Hashed User',
      email: 'hasheduser@example.com',
      password: plaintext,
      phone: '+91 98765 43210',
      role: 'customer',
    });

    const rawUsers = JSON.parse(await fs.readFile(path.join(tempDir, 'users.json'), 'utf8'));
    const storedUser = rawUsers.find((u) => u.id === regResult.user.id);

    assert.ok(storedUser);
    assert.notEqual(storedUser.passwordHash, plaintext);
    assert.ok(storedUser.passwordHash.startsWith('$2a$') || storedUser.passwordHash.startsWith('$2b$'));
    assert.equal(storedUser.password, undefined);
  });

  test('12. JWT is signed with secret and contains userId, role, and expiration', async () => {
    const regResult = await authService.register({
      name: 'JWT User',
      email: 'jwtuser@example.com',
      password: 'JWTPassword123!',
      phone: '+91 98765 43210',
      role: 'restaurant',
    });

    const decoded = jwt.verify(regResult.token, process.env.JWT_SECRET);
    assert.equal(decoded.userId, regResult.user.id);
    assert.equal(decoded.email, 'jwtuser@example.com');
    assert.equal(decoded.role, 'restaurant');
    assert.ok(decoded.iat);
    assert.ok(decoded.exp);
    assert.ok(decoded.exp > decoded.iat);
  });

  // --- Prompt 1.3B Tests: Middleware, Roles, Concurrency, and GET /me ---

  test('13. authenticateToken passes and populates req.user for valid token', async () => {
    const reg = await authService.register({
      name: 'Token User',
      email: 'tokenuser@example.com',
      password: 'Password123!',
      phone: '+91 98765 43210',
      role: 'customer',
    });

    const req = {
      headers: { authorization: `Bearer ${reg.token}` },
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware.authenticateToken(req, res, next);

    assert.equal(nextCalled, true);
    assert.ok(req.user);
    assert.equal(req.user.id, reg.user.id);
    assert.equal(req.user.email, 'tokenuser@example.com');
    assert.equal(req.user.passwordHash, undefined);
  });

  test('14. authenticateToken rejects missing token with HTTP 401', async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware.authenticateToken(req, res, next);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  test('15. authenticateToken rejects invalid/tampered token with HTTP 401', async () => {
    const req = {
      headers: { authorization: 'Bearer completely.invalid.jwt.token' },
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware.authenticateToken(req, res, next);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
    assert.match(res.body.error.message, /invalid authentication token/i);
  });

  test('16. authenticateToken rejects expired token with HTTP 401', async () => {
    // Generate a token that expired 10 seconds ago
    const expiredToken = jwt.sign(
      { userId: 'usr_mock_123', email: 'exp@example.com', role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const req = {
      headers: { authorization: `Bearer ${expiredToken}` },
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware.authenticateToken(req, res, next);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
    assert.match(res.body.error.message, /expired/i);
  });

  test('17. authenticateToken rejects token if user no longer exists in repository', async () => {
    // Token with random non-existent user ID
    const validToken = jwt.sign(
      { userId: 'usr_nonexistent_9999', email: 'deleted@example.com', role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const req = {
      headers: { authorization: `Bearer ${validToken}` },
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware.authenticateToken(req, res, next);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
    assert.match(res.body.error.message, /no longer exists/i);
  });

  test('18. authorizeRoles allows access when user role matches requirement', async () => {
    const middleware = authMiddleware.authorizeRoles('restaurant', 'delivery');
    const req = { user: { id: 'usr_1', role: 'restaurant' } };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware(req, res, next);
    assert.equal(nextCalled, true);
  });

  test('19. authorizeRoles rejects with HTTP 403 when user lacks required role', async () => {
    const middleware = authMiddleware.authorizeRoles('restaurant');
    const req = { user: { id: 'usr_1', role: 'customer' } };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware(req, res, next);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
    assert.match(res.body.error.message, /access denied/i);
  });

  test('20. GET /api/auth/me returns currently authenticated user profile', async () => {
    const reg = await authService.register({
      name: 'Profile User',
      email: 'profile@example.com',
      password: 'Password123!',
      phone: '+91 98765 43210',
      role: 'customer',
    });

    const req = { user: reg.user };
    const res = createMockRes();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authController.getMe(req, res, next);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.id, reg.user.id);
    assert.equal(res.body.data.user.email, 'profile@example.com');
    assert.equal(res.body.data.user.passwordHash, undefined);
  });

  test('21. Concurrency regression: 10 simultaneous registrations with identical email create exactly 1 user', async () => {
    const concurrencyCount = 10;
    const duplicateEmail = 'concurrent-race@example.com';

    const registrationPromises = [];
    for (let i = 0; i < concurrencyCount; i++) {
      registrationPromises.push(
        authService
          .register({
            name: `User ${i}`,
            email: duplicateEmail,
            password: 'StrongPassword123!',
            phone: `+91 98765 432${i}0`,
            role: 'customer',
          })
          .then((res) => ({ success: true, result: res }))
          .catch((err) => ({ success: false, error: err }))
      );
    }

    const settled = await Promise.all(registrationPromises);

    const successes = settled.filter((s) => s.success);
    const conflicts = settled.filter((s) => !s.success && s.error.code === 'CONFLICT');

    // Exactly one registration must succeed
    assert.equal(successes.length, 1);
    // The other 9 must be cleanly rejected with 409 Conflict
    assert.equal(conflicts.length, concurrencyCount - 1);

    // Verify on disk in users.json that exactly 1 user exists
    const usersOnDisk = JSON.parse(await fs.readFile(path.join(tempDir, 'users.json'), 'utf8'));
    assert.equal(usersOnDisk.length, 1);
    assert.equal(usersOnDisk[0].email, duplicateEmail);
  });
});
