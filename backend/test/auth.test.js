import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { readJson, writeJson } from '../src/utils/jsonStorage.js';

describe('Authentication & JWT Authorization Module (Syllabus Standard)', () => {
  let server;
  let baseUrl;
  let initialUsersBackup = [];
  let initialCustomersBackup = [];

  before(async () => {
    // Backup state
    initialUsersBackup = await readJson('users.json');
    initialCustomersBackup = await readJson('customers.json');

    // Clean any residual test users
    const cleanUsers = initialUsersBackup.filter((u) => !u.email.includes('test'));
    await writeJson('users.json', cleanUsers);

    // Start ephemeral server on random port
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Restore state
    await writeJson('users.json', initialUsersBackup);
    await writeJson('customers.json', initialCustomersBackup);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. User Registration (POST /api/auth/register)', () => {
    it('should register a new customer and return JWT token with sanitized user', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neha Verma',
          email: 'neha.test@example.com',
          password: 'securePassword123',
          phone: '+91 99887 76655'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.token, 'Should return a JWT token');
      assert.strictEqual(typeof body.data.token, 'string');
      assert.strictEqual(body.data.user.name, 'Neha Verma');
      assert.strictEqual(body.data.user.email, 'neha.test@example.com');
      assert.strictEqual(body.data.user.role, 'customer');
      assert.strictEqual(body.data.user.passwordHash, undefined, 'Password hash must never be leaked');
    });

    it('should reject registration when email already exists (409 Conflict)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Neha',
          email: 'neha.test@example.com',
          password: 'anotherPassword123'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 409);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration with password shorter than 6 characters', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('2. User Login (POST /api/auth/login)', () => {
    it('should authenticate pre-seeded test customer Tarshit Gupta with password123', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'tarshit@example.com',
          password: 'password123'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.token, 'Must return JWT token');
      assert.strictEqual(body.data.user.id, 'cust_8829');
      assert.strictEqual(body.data.user.role, 'customer');
    });

    it('should reject login with wrong password (401 INVALID_CREDENTIALS)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'tarshit@example.com',
          password: 'wrongPassword999'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ghost@example.com',
          password: 'password123'
        })
      });

      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
    });
  });

  describe('3. Protected User Profile (GET /api/auth/me)', () => {
    let authToken = '';

    before(async () => {
      // Login to obtain valid JWT
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'tarshit@example.com',
          password: 'password123'
        })
      });
      const loginBody = await loginRes.json();
      authToken = loginBody.data.token;
    });

    it('should allow access to /api/auth/me when valid Bearer token is provided', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.id, 'cust_8829');
      assert.strictEqual(body.data.email, 'tarshit@example.com');
    });

    it('should reject access to /api/auth/me when Bearer token is missing (401 UNAUTHORIZED)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      const body = await res.json();

      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    it('should reject access to /api/auth/me when tampered/invalid token is provided', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: 'Bearer fake.invalid.jwt.token'
        }
      });

      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_TOKEN');
    });
  });
});
