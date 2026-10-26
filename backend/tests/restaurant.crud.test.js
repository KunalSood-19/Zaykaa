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
import { RestaurantRepository } from '../src/modules/restaurants/restaurant.repository.js';
import { RestaurantService } from '../src/modules/restaurants/restaurant.service.js';
import { RestaurantController } from '../src/modules/restaurants/restaurant.controller.js';
import { createRestaurantRouter } from '../src/modules/restaurants/restaurant.routes.js';

// Test JWT Secret setup
process.env.JWT_SECRET = 'test_jwt_secret_for_restaurant_crud_tests_987654321';
process.env.JWT_EXPIRES_IN = '24h';

describe('Restaurant CRUD API & Service Tests (M2 Prompt 2.0)', () => {
  let tempDir;
  let isolatedStore;
  let authRepository;
  let authService;
  let authMiddleware;
  let restaurantRepository;
  let restaurantService;
  let restaurantController;
  let server;
  let baseUrl;

  let ownerToken;
  let ownerUser;
  let ownerToken2;
  let ownerUser2;
  let customerToken;
  let deliveryToken;

  const validRestaurantPayload = {
    name: 'Spice Symphony',
    description: 'Authentic North Indian & Tandoori specialties',
    cuisineTypes: ['North Indian', 'Mughlai', 'Biryani'],
    address: {
      street: '42 Outer Ring Road, Indiranagar',
      city: 'Bengaluru',
      pincode: '560038',
    },
    phone: '+91 80 4123 4567',
    imageUrl: '/assets/images/restaurants/spice-symphony.jpg',
    isOpen: true,
  };

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-restaurant-test-'));
    isolatedStore = new JsonStore(tempDir);

    authRepository = new AuthRepository(isolatedStore);
    authService = new AuthService(authRepository);
    authMiddleware = createAuthMiddleware(authRepository);

    restaurantRepository = new RestaurantRepository(isolatedStore);
    restaurantService = new RestaurantService(restaurantRepository);
    restaurantController = new RestaurantController(restaurantService);

    const restaurantRouter = createRestaurantRouter(restaurantController, authMiddleware);

    const app = express();
    app.use(express.json());
    app.use('/api/restaurants', restaurantRouter);

    // 404 handler for unmatched routes
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
        baseUrl = `http://localhost:${port}/api/restaurants`;
        resolve();
      });
    });

    // Seed test users: 2 restaurant owners, 1 customer, 1 delivery partner
    const ownerReg1 = await authService.register({
      name: 'Restaurant Owner One',
      email: 'owner1@restaurant.com',
      password: 'OwnerPassword123!',
      phone: '+91 98765 00001',
      role: 'restaurant',
    });
    ownerToken = ownerReg1.token;
    ownerUser = ownerReg1.user;

    const ownerReg2 = await authService.register({
      name: 'Restaurant Owner Two',
      email: 'owner2@restaurant.com',
      password: 'OwnerPassword123!',
      phone: '+91 98765 00002',
      role: 'restaurant',
    });
    ownerToken2 = ownerReg2.token;
    ownerUser2 = ownerReg2.user;

    const custReg = await authService.register({
      name: 'Regular Customer',
      email: 'customer@test.com',
      password: 'CustomerPassword123!',
      phone: '+91 98765 00003',
      role: 'customer',
    });
    customerToken = custReg.token;

    const delReg = await authService.register({
      name: 'Delivery Agent',
      email: 'delivery@test.com',
      password: 'DeliveryPassword123!',
      phone: '+91 98765 00004',
      role: 'delivery',
    });
    deliveryToken = delReg.token;
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

  // Clean the restaurants.json file before each test to keep tests isolated
  beforeEach(async () => {
    await fs.writeFile(path.join(tempDir, 'restaurants.json'), '[]\n', 'utf8');
  });

  // --- 1. Creation Tests ---

  test('1. Successful restaurant creation creates profile and returns HTTP 201', async () => {
    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id.startsWith('rst_'));
    assert.equal(body.data.ownerId, ownerUser.id);
    assert.equal(body.data.name, 'Spice Symphony');
    assert.equal(body.data.isOpen, true);
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
  });

  test('2. Missing or invalid creation fields rejected with HTTP 400 VALIDATION_ERROR', async () => {
    // Missing name
    const invalidPayload = { ...validRestaurantPayload };
    delete invalidPayload.name;

    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(invalidPayload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
  });

  test('3. Unauthenticated restaurant creation is rejected with HTTP 401 UNAUTHORIZED', async () => {
    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRestaurantPayload),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('4. Wrong-role creation rejected with HTTP 403 FORBIDDEN for customer and delivery roles', async () => {
    // Customer attempt
    const resCustomer = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    assert.equal(resCustomer.status, 403);
    const bodyCust = await resCustomer.json();
    assert.equal(bodyCust.error.code, 'FORBIDDEN');

    // Delivery agent attempt
    const resDelivery = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    assert.equal(resDelivery.status, 403);
    const bodyDel = await resDelivery.json();
    assert.equal(bodyDel.error.code, 'FORBIDDEN');
  });

  test('5. One restaurant per owner enforced (HTTP 409 CONFLICT on second creation)', async () => {
    // First creation succeeds
    const res1 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    assert.equal(res1.status, 201);

    // Second creation by same owner must fail with 409 CONFLICT
    const res2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        ...validRestaurantPayload,
        name: 'Second Restaurant By Same Owner',
      }),
    });
    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.equal(body2.success, false);
    assert.equal(body2.error.code, 'CONFLICT');
  });

  test('6. Concurrent duplicate creation prevented within storage mutex serialization', async () => {
    // Fire 6 simultaneous creation requests from the same owner
    const requests = Array.from({ length: 6 }).map((_, index) =>
      fetch(`${baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          ...validRestaurantPayload,
          name: `Concurrent Restaurant ${index}`,
        }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    const successCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    assert.equal(successCount, 1, 'Exactly one concurrent request must succeed');
    assert.equal(conflictCount, 5, 'All other concurrent requests must receive 409 CONFLICT');

    // Verify disk contains exactly 1 restaurant
    const rawData = JSON.parse(await fs.readFile(path.join(tempDir, 'restaurants.json'), 'utf8'));
    assert.equal(rawData.length, 1);
  });

  // --- 2. Discovery & Retrieval Tests ---

  test('7. Public listing and restaurant details by ID without authentication', async () => {
    // Seed 2 restaurants using owner1 and owner2
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });

    const res2 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken2}`,
      },
      body: JSON.stringify({
        name: 'Dosa Plaza',
        description: 'Crispy South Indian dosas and filter coffee',
        cuisineTypes: ['South Indian', 'Fast Food'],
        address: {
          street: '100 Feet Road, Koramangala',
          city: 'Bengaluru',
          pincode: '560034',
        },
        phone: '+91 80 4123 9999',
        imageUrl: '/assets/images/restaurants/dosa-plaza.jpg',
        isOpen: true,
      }),
    });
    const created2 = await res2.json();

    // 1. List all restaurants without any auth token
    const listRes = await fetch(`${baseUrl}`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.success, true);
    assert.equal(listBody.data.length, 2);

    // 2. Query filter by search
    const searchRes = await fetch(`${baseUrl}?search=dosa`);
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.data.length, 1);
    assert.equal(searchBody.data[0].name, 'Dosa Plaza');

    // 3. Query filter by cuisine
    const cuisineRes = await fetch(`${baseUrl}?cuisine=North+Indian`);
    assert.equal(cuisineRes.status, 200);
    const cuisineBody = await cuisineRes.json();
    assert.equal(cuisineBody.data.length, 1);
    assert.equal(cuisineBody.data[0].name, 'Spice Symphony');

    // 4. Get by ID
    const singleRes = await fetch(`${baseUrl}/${created2.data.id}`);
    assert.equal(singleRes.status, 200);
    const singleBody = await singleRes.json();
    assert.equal(singleBody.success, true);
    assert.equal(singleBody.data.name, 'Dosa Plaza');
  });

  test('8. Missing restaurant returns HTTP 404 NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/rst_nonexistent_id_12345`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('9. GET /api/restaurants/mine returns authenticated owner restaurant', async () => {
    // Before creation, returns 404
    const resBefore = await fetch(`${baseUrl}/mine`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resBefore.status, 404);

    // Create restaurant
    await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });

    // After creation, returns restaurant
    const resAfter = await fetch(`${baseUrl}/mine`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resAfter.status, 200);
    const body = await resAfter.json();
    assert.equal(body.success, true);
    assert.equal(body.data.ownerId, ownerUser.id);
    assert.equal(body.data.name, 'Spice Symphony');
  });

  // --- 3. Update & Ownership Tests ---

  test('10. Owner can update restaurant profile', async () => {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    const created = await createRes.json();

    const updateRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Spice Symphony Express',
        isOpen: false,
      }),
    });

    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.success, true);
    assert.equal(updateBody.data.name, 'Spice Symphony Express');
    assert.equal(updateBody.data.isOpen, false);
    assert.equal(updateBody.data.id, created.data.id);
    assert.equal(updateBody.data.ownerId, ownerUser.id);
  });

  test('11. Non-owner cannot update restaurant (HTTP 403 FORBIDDEN)', async () => {
    // Created by owner1
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    const created = await createRes.json();

    // Owner 2 tries to update Owner 1's restaurant
    const updateRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken2}`,
      },
      body: JSON.stringify({
        name: 'Hacked By Owner 2',
      }),
    });

    assert.equal(updateRes.status, 403);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.success, false);
    assert.equal(updateBody.error.code, 'FORBIDDEN');
  });

  test('12. Protected fields cannot be modified during update (HTTP 400 VALIDATION_ERROR)', async () => {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    const created = await createRes.json();

    // Attempt to tamper with id and ownerId
    const updateRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        id: 'rst_tampered_id',
        ownerId: 'usr_tampered_owner',
      }),
    });

    assert.equal(updateRes.status, 400);
    const body = await updateRes.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('13. Partial update works without overwriting unspecified fields', async () => {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    const created = await createRes.json();

    const updateRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        description: 'Updated description only',
      }),
    });

    assert.equal(updateRes.status, 200);
    const body = await updateRes.json();
    assert.equal(body.data.description, 'Updated description only');
    assert.equal(body.data.name, validRestaurantPayload.name);
    assert.equal(body.data.phone, validRestaurantPayload.phone);
    assert.deepEqual(body.data.cuisineTypes, validRestaurantPayload.cuisineTypes);
    assert.deepEqual(body.data.address, validRestaurantPayload.address);
  });

  test('14. Persistence survives subsequent reads directly from storage', async () => {
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    const created = await createRes.json();

    // Read directly from disk file via a new JsonStore instance
    const verifyStore = new JsonStore(tempDir);
    const directRead = await verifyStore.findById('restaurants', created.data.id);

    assert.ok(directRead);
    assert.equal(directRead.id, created.data.id);
    assert.equal(directRead.name, 'Spice Symphony');
    assert.equal(directRead.ownerId, ownerUser.id);
  });

  // --- 4. Delete Tests ---

  test('15. Delete behavior matches contract: owner can delete, non-owner gets 403, missing gets 404', async () => {
    // 1. Create restaurant
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    const created = await createRes.json();

    // 2. Non-existent restaurant returns 404
    const delMissingRes = await fetch(`${baseUrl}/rst_random_missing_99999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delMissingRes.status, 404);

    // 3. Non-owner cannot delete (Owner 2 tries to delete Owner 1's restaurant)
    const delNonOwnerRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken2}` },
    });
    assert.equal(delNonOwnerRes.status, 403);
    const nonOwnerBody = await delNonOwnerRes.json();
    assert.equal(nonOwnerBody.error.code, 'FORBIDDEN');

    // 4. Owner successfully deletes restaurant
    const delOwnerRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delOwnerRes.status, 200);
    const ownerBody = await delOwnerRes.json();
    assert.equal(ownerBody.success, true);

    // 5. Subsequent read returns 404
    const getDeletedRes = await fetch(`${baseUrl}/${created.data.id}`);
    assert.equal(getDeletedRes.status, 404);

    // 6. Owner can now create a new restaurant after deleting the previous one
    const createAgainRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(validRestaurantPayload),
    });
    assert.equal(createAgainRes.status, 201);
  });
});
