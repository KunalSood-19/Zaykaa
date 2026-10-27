import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import express from 'express';
import { JsonStore } from '../src/utils/jsonStore.js';
import { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { createAuthMiddleware } from '../src/middleware/auth.middleware.js';
import { DeliveryRepository } from '../src/modules/delivery/delivery.repository.js';
import { DeliveryService } from '../src/modules/delivery/delivery.service.js';
import { DeliveryController } from '../src/modules/delivery/delivery.controller.js';
import { createDeliveryRouter } from '../src/modules/delivery/delivery.routes.js';

// Test JWT Secret setup
process.env.JWT_SECRET = 'test_jwt_secret_for_delivery_tests_1234567890';
process.env.JWT_EXPIRES_IN = '24h';

describe('Delivery Partner Profile & Availability API Tests (M2 Prompt 2.2)', () => {
  let tempDir;
  let isolatedStore;
  let authRepository;
  let authService;
  let authMiddleware;
  let deliveryRepository;
  let deliveryService;
  let deliveryController;
  let server;
  let baseUrl;

  let deliveryUser1;
  let deliveryToken1;
  let deliveryUser2;
  let deliveryToken2;
  let customerToken;
  let restaurantToken;

  const validProfilePayload = {
    vehicleType: 'Motorcycle',
  };

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-delivery-test-'));
    isolatedStore = new JsonStore(tempDir);

    authRepository = new AuthRepository(isolatedStore);
    authService = new AuthService(authRepository);
    authMiddleware = createAuthMiddleware(authRepository);

    deliveryRepository = new DeliveryRepository(isolatedStore);
    deliveryService = new DeliveryService(deliveryRepository);
    deliveryController = new DeliveryController(deliveryService);

    const deliveryRouter = createDeliveryRouter(deliveryController, authMiddleware);

    const app = express();
    app.use(express.json());
    app.use('/api/partners', deliveryRouter);

    // API 404 handler for unmatched routes
    app.use('/api', (req, res) => {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
    });

    // Centralized error handler
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      const statusCode = err.statusCode || err.status || 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Error',
          ...(err.details ? { details: err.details } : {}),
        },
      });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/partners`;
        resolve();
      });
    });

    // Seed test users
    const del1 = await authService.register({
      name: 'Ramesh Rider',
      email: 'ramesh.delivery@test.com',
      password: 'RiderPassword123!',
      phone: '+91 98765 66661',
      role: 'delivery',
    });
    deliveryUser1 = del1.user;
    deliveryToken1 = del1.token;

    const del2 = await authService.register({
      name: 'Suresh Scooter',
      email: 'suresh.delivery@test.com',
      password: 'RiderPassword123!',
      phone: '+91 98765 66662',
      role: 'delivery',
    });
    deliveryUser2 = del2.user;
    deliveryToken2 = del2.token;

    const cust = await authService.register({
      name: 'Anita Customer',
      email: 'anita.cust@test.com',
      password: 'CustPassword123!',
      phone: '+91 98765 66663',
      role: 'customer',
    });
    customerToken = cust.token;

    const rest = await authService.register({
      name: 'Bawarchi Owner',
      email: 'bawarchi.rest@test.com',
      password: 'RestPassword123!',
      phone: '+91 98765 66664',
      role: 'restaurant',
    });
    restaurantToken = rest.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  beforeEach(async () => {
    // Reset delivery_partners collection before each test
    await fs.writeFile(path.join(tempDir, 'delivery_partners.json'), '[]\n', 'utf8');
  });

  // --- 1. Profile Creation & Initial State Tests ---

  test('1. Successful delivery partner profile creation with correct canonical fields (HTTP 201 Created)', async () => {
    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id.startsWith('del_'));
    assert.equal(body.data.userId, deliveryUser1.id);
    assert.equal(body.data.vehicleType, 'Motorcycle');
    assert.equal(body.data.isAvailable, false); // Default: starts unavailable
    assert.equal(body.data.activeOrderId, null); // Initially idle
    assert.equal(body.data.totalDeliveries, 0); // Initially 0
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
  });

  test('2. Valid vehicle types are accepted and invalid vehicle types are rejected (HTTP 400 VALIDATION_ERROR)', async () => {
    const validVehicles = ['Motorcycle', 'Scooter', 'Bicycle', 'Electric Vehicle'];

    for (const vehicle of validVehicles) {
      // Clean collection before each sub-check
      await fs.writeFile(path.join(tempDir, 'delivery_partners.json'), '[]\n', 'utf8');

      const res = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deliveryToken1}`,
        },
        body: JSON.stringify({ vehicleType: vehicle }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.vehicleType, vehicle);
    }

    // Invalid vehicle type
    const resInvalid = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken2}`,
      },
      body: JSON.stringify({ vehicleType: 'Helicopter' }),
    });
    assert.equal(resInvalid.status, 400);
    const bodyInvalid = await resInvalid.json();
    assert.equal(bodyInvalid.error.code, 'VALIDATION_ERROR');
  });

  test('3. Duplicate profile creation rejected (HTTP 409 CONFLICT)', async () => {
    // First creation succeeds
    const res1 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });
    assert.equal(res1.status, 201);

    // Second creation by same user rejected with 409 Conflict
    const res2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ vehicleType: 'Scooter' }),
    });
    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.equal(body2.error.code, 'CONFLICT');
  });

  test('4. Concurrent duplicate profile creation prevented within storage mutex serialization', async () => {
    // 6 simultaneous POST requests from same user
    const requests = Array.from({ length: 6 }).map((_, i) =>
      fetch(`${baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deliveryToken1}`,
        },
        body: JSON.stringify({ vehicleType: i % 2 === 0 ? 'Scooter' : 'Motorcycle' }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    const successCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    assert.equal(successCount, 1, 'Exactly one concurrent request must succeed');
    assert.equal(conflictCount, 5, 'All other concurrent requests must receive 409 CONFLICT');

    // Verify storage file contains exactly 1 record
    const diskItems = JSON.parse(
      await fs.readFile(path.join(tempDir, 'delivery_partners.json'), 'utf8')
    );
    assert.equal(diskItems.length, 1);
  });

  // --- 2. Authorization & Role Checks ---

  test('5. Unauthenticated request rejected (HTTP 401 UNAUTHORIZED)', async () => {
    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validProfilePayload),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('6. Non-delivery roles (customer and restaurant) cannot create or access delivery partner profile (HTTP 403 FORBIDDEN)', async () => {
    // Customer
    const resCust = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(validProfilePayload),
    });
    assert.equal(resCust.status, 403);
    const bodyCust = await resCust.json();
    assert.equal(bodyCust.error.code, 'FORBIDDEN');

    // Restaurant
    const resRest = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restaurantToken}`,
      },
      body: JSON.stringify(validProfilePayload),
    });
    assert.equal(resRest.status, 403);
    const bodyRest = await resRest.json();
    assert.equal(bodyRest.error.code, 'FORBIDDEN');
  });

  // --- 3. Retrieval & Dashboard Tests ---

  test('7. Successful profile retrieval via GET /api/partners/me and /api/partners/profile (HTTP 200 OK)', async () => {
    // 1. Create profile
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });

    // 2. Retrieve via /me
    const resMe = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(resMe.status, 200);
    const bodyMe = await resMe.json();
    assert.equal(bodyMe.success, true);
    assert.equal(bodyMe.data.userId, deliveryUser1.id);
    assert.equal(bodyMe.data.vehicleType, 'Motorcycle');

    // 3. Retrieve via /profile
    const resProf = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(resProf.status, 200);
    const bodyProf = await resProf.json();
    assert.equal(bodyProf.data.id, bodyMe.data.id);
  });

  test('8. Dashboard overview returns partner details and active/available orders payload (HTTP 200 OK)', async () => {
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });

    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.partner);
    assert.equal(body.data.partner.userId, deliveryUser1.id);
    assert.equal(body.data.activeOrder, null);
    assert.deepEqual(body.data.availableOrders, []);
  });

  // --- 4. Profile Updates & Protected Fields ---

  test('9. Partner can update allowed fields (vehicleType) via PUT /api/partners/profile (HTTP 200 OK)', async () => {
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });

    const res = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ vehicleType: 'Electric Vehicle' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.vehicleType, 'Electric Vehicle');
    assert.equal(body.data.userId, deliveryUser1.id);
  });

  test('10. Protected fields (id, userId, activeOrderId, totalDeliveries) cannot be modified by client (HTTP 400 VALIDATION_ERROR)', async () => {
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });

    // Attempt tampering with userId and totalDeliveries
    const res = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({
        userId: 'usr_tampered_hacker',
        totalDeliveries: 9999,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('11. Non-owner cannot update or access another partner profile by ID (HTTP 403 FORBIDDEN)', async () => {
    // Partner 1 creates profile
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });
    const created1 = await createRes.json();

    // Partner 2 attempts to update Partner 1's profile
    const updateRes = await fetch(`${baseUrl}/${created1.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken2}`,
      },
      body: JSON.stringify({ vehicleType: 'Scooter' }),
    });
    assert.equal(updateRes.status, 403);
    const bodyUpdate = await updateRes.json();
    assert.equal(bodyUpdate.error.code, 'FORBIDDEN');

    // Partner 2 attempts to get Partner 1's profile by ID
    const getRes = await fetch(`${baseUrl}/${created1.data.id}`, {
      headers: { Authorization: `Bearer ${deliveryToken2}` },
    });
    assert.equal(getRes.status, 403);
  });

  // --- 5. Availability Toggles & Active Order Restriction ---

  test('12. Partner can toggle availability via PATCH /api/partners/availability', async () => {
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });

    // 1. Turn ON availability
    const resOn = await fetch(`${baseUrl}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ isAvailable: true }),
    });
    assert.equal(resOn.status, 200);
    const bodyOn = await resOn.json();
    assert.equal(bodyOn.data.isAvailable, true);

    // 2. Turn OFF availability
    const resOff = await fetch(`${baseUrl}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    });
    assert.equal(resOff.status, 200);
    const bodyOff = await resOff.json();
    assert.equal(bodyOff.data.isAvailable, false);

    // 3. Reject non-boolean value
    const resInvalid = await fetch(`${baseUrl}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ isAvailable: 'yes' }),
    });
    assert.equal(resInvalid.status, 400);
  });

  test('13. Active order restriction: Partner with activeOrderId cannot toggle isAvailable to true (HTTP 400)', async () => {
    // Create partner
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });
    const created = await createRes.json();

    // Directly simulate active delivery order in repository
    await deliveryRepository.update(created.data.id, {
      activeOrderId: 'ord_active_test_123',
      isAvailable: false,
    });

    // Partner attempts to mark themselves available while on active order
    const res = await fetch(`${baseUrl}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ isAvailable: true }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'ACTIVE_ORDER_RESTRICTION');

    // Confirm partner remains unavailable in storage
    const stored = await deliveryRepository.findById(created.data.id);
    assert.equal(stored.isAvailable, false);
  });

  test('14. Persistence verified after profile updates and availability toggles', async () => {
    // 1. Create partner
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify(validProfilePayload),
    });
    const created = await createRes.json();

    // 2. Update vehicle and availability
    await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ vehicleType: 'Bicycle', isAvailable: true }),
    });

    // 3. Read directly from disk with new store instance
    const freshStore = new JsonStore(tempDir);
    const diskRecord = await freshStore.findById('delivery_partners', created.data.id);

    assert.ok(diskRecord);
    assert.equal(diskRecord.vehicleType, 'Bicycle');
    assert.equal(diskRecord.isAvailable, true);
    assert.equal(diskRecord.userId, deliveryUser1.id);
  });
});
