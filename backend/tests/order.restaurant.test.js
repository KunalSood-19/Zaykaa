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
import { DeliveryRepository } from '../src/modules/delivery/delivery.repository.js';
import { OrderRepository } from '../src/modules/orders/order.repository.js';
import { OrderService } from '../src/modules/orders/order.service.js';
import { OrderController } from '../src/modules/orders/order.controller.js';
import { createOrderRouter } from '../src/modules/orders/order.routes.js';

process.env.JWT_SECRET = 'test_jwt_secret_for_restaurant_order_tests_12345';
process.env.JWT_EXPIRES_IN = '24h';

describe('Restaurant Order Management API & Lifecycle Tests (M2 Prompt 2.3)', () => {
  let tempDir;
  let isolatedStore;
  let authRepository;
  let authService;
  let authMiddleware;
  let restaurantRepository;
  let deliveryRepository;
  let orderRepository;
  let orderService;
  let orderController;
  let server;
  let baseUrl;

  let owner1User, owner1Token, restaurant1;
  let owner2User, owner2Token, restaurant2;
  let customerUser, customerToken;
  let deliveryUser, deliveryToken;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-order-test-'));
    isolatedStore = new JsonStore(tempDir);

    authRepository = new AuthRepository(isolatedStore);
    authService = new AuthService(authRepository);
    authMiddleware = createAuthMiddleware(authRepository);

    restaurantRepository = new RestaurantRepository(isolatedStore);
    deliveryRepository = new DeliveryRepository(isolatedStore);
    orderRepository = new OrderRepository(isolatedStore);
    orderService = new OrderService(orderRepository, restaurantRepository, deliveryRepository);
    orderController = new OrderController(orderService);

    const orderRouter = createOrderRouter(orderController, authMiddleware);

    const app = express();
    app.use(express.json());
    app.use('/api/orders', orderRouter);

    app.use('/api', (req, res) => {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
    });

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
        baseUrl = `http://localhost:${port}/api/orders`;
        resolve();
      });
    });

    // Seed Owner 1 & Restaurant 1
    const regOwner1 = await authService.register({
      name: 'Chef Sanjeev',
      email: 'sanjeev@khazana.com',
      password: 'ChefPassword123!',
      phone: '+91 98765 11111',
      role: 'restaurant',
    });
    owner1User = regOwner1.user;
    owner1Token = regOwner1.token;

    restaurant1 = await restaurantRepository.createRestaurantWithUniqueOwner({
      ownerId: owner1User.id,
      name: 'Khazana Kitchen',
      description: 'Authentic royal culinary dining',
      cuisineTypes: ['North Indian', 'Mughlai'],
      address: {
        street: '12 Palace Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      phone: '+91 98765 11111',
      imageUrl: 'https://images.unsplash.com/photo-kitchen',
      isOpen: true,
    });

    // Seed Owner 2 & Restaurant 2
    const regOwner2 = await authService.register({
      name: 'Chef Ranveer',
      email: 'ranveer@tadka.com',
      password: 'ChefPassword123!',
      phone: '+91 98765 22222',
      role: 'restaurant',
    });
    owner2User = regOwner2.user;
    owner2Token = regOwner2.token;

    restaurant2 = await restaurantRepository.createRestaurantWithUniqueOwner({
      ownerId: owner2User.id,
      name: 'Tadka Junction',
      description: 'Zesty Indian street bites',
      cuisineTypes: ['Street Food', 'Snacks'],
      address: {
        street: '88 Market St',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560002',
      },
      phone: '+91 98765 22222',
      imageUrl: 'https://images.unsplash.com/photo-tadka',
      isOpen: true,
    });

    // Seed Customer
    const regCustomer = await authService.register({
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: 'CustomerPassword123!',
      phone: '+91 98765 33333',
      role: 'customer',
    });
    customerUser = regCustomer.user;
    customerToken = regCustomer.token;

    // Seed Delivery Partner
    const regDelivery = await authService.register({
      name: 'Kishore Rider',
      email: 'kishore@delivery.com',
      password: 'RiderPassword123!',
      phone: '+91 98765 44444',
      role: 'delivery',
    });
    deliveryUser = regDelivery.user;
    deliveryToken = regDelivery.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Reset orders collection between tests for predictable fixtures
    await isolatedStore._writeAtomic('orders', []);
  });

  // Helper to create a canonical mock order
  async function createMockOrder(overrides = {}) {
    const defaultOrder = {
      customerId: customerUser.id,
      customerName: 'Priya Sharma',
      customerPhone: '+91 98765 33333',
      restaurantId: restaurant1.id,
      restaurantName: 'Khazana Kitchen',
      deliveryPartnerId: null,
      status: 'Placed',
      items: [
        {
          itemId: 'item_dummy_1',
          name: 'Butter Chicken',
          quantity: 2,
          price: 35000,
        },
      ],
      pricing: {
        subtotal: 70000,
        deliveryFee: 4000,
        tax: 3500,
        total: 77500,
      },
      deliveryAddress: {
        street: '45 Lake View Road',
        city: 'Bengaluru',
        pincode: '560001',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    return orderRepository.create(defaultOrder);
  }

  test('1. Restaurant owner retrieves incoming orders belonging only to their restaurant sorted newest first', async () => {
    const olderTime = new Date('2026-10-25T10:00:00.000Z').toISOString();
    const newerTime = new Date('2026-10-25T12:00:00.000Z').toISOString();

    const orderOld = await createMockOrder({
      restaurantId: restaurant1.id,
      timestamps: { createdAt: olderTime, updatedAt: olderTime },
    });
    const orderNew = await createMockOrder({
      restaurantId: restaurant1.id,
      timestamps: { createdAt: newerTime, updatedAt: newerTime },
    });
    // Order for restaurant 2
    await createMockOrder({
      restaurantId: restaurant2.id,
      restaurantName: 'Tadka Junction',
    });

    const res = await fetch(`${baseUrl}/restaurant/${restaurant1.id}`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    // Descending sort check: newer first
    assert.equal(body.data[0].id, orderNew.id);
    assert.equal(body.data[1].id, orderOld.id);
    // Strict restaurant isolation
    assert.ok(body.data.every((o) => o.restaurantId === restaurant1.id));
  });

  test('2. Cross-restaurant isolation: Restaurant owner cannot list orders of another restaurant', async () => {
    const res = await fetch(`${baseUrl}/restaurant/${restaurant1.id}`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('3. Querying incoming orders for non-existent restaurant returns HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/restaurant/rst_non_existent_12345`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('4. Restaurant owner can view complete details of their individual restaurant order', async () => {
    const order = await createMockOrder({ restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, order.id);
    assert.equal(body.data.restaurantId, restaurant1.id);
    assert.equal(body.data.customerName, 'Priya Sharma');
    assert.equal(body.data.pricing.total, 77500);
    assert.equal(body.data.items[0].name, 'Butter Chicken');
  });

  test('5. Cross-restaurant isolation: Restaurant owner cannot view details of another restaurant order', async () => {
    const order = await createMockOrder({ restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('6. Viewing a non-existent order returns HTTP 404 NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/ord_non_existent_id_999`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('7. Lifecycle step: Owner accepts an order in Placed status (Placed -> Accepted)', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Accepted' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'Accepted');

    // Verify storage update
    const saved = await orderRepository.findById(order.id);
    assert.equal(saved.status, 'Accepted');
  });

  test('8. Lifecycle step: Owner rejects an order in Placed status (Placed -> Rejected)', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Rejected' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'Rejected');

    const saved = await orderRepository.findById(order.id);
    assert.equal(saved.status, 'Rejected');
  });

  test('9. Lifecycle step: Owner moves accepted order to Preparing (Accepted -> Preparing)', async () => {
    const order = await createMockOrder({ status: 'Accepted', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Preparing' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'Preparing');

    const saved = await orderRepository.findById(order.id);
    assert.equal(saved.status, 'Preparing');
  });

  test('10. Lifecycle step: Owner moves preparing order to Ready for Pickup (Preparing -> Ready for Pickup)', async () => {
    const order = await createMockOrder({ status: 'Preparing', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Ready for Pickup' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'Ready for Pickup');

    const saved = await orderRepository.findById(order.id);
    assert.equal(saved.status, 'Ready for Pickup');
  });

  test('11. Invalid status transition: Placed directly to Preparing (skipping Accepted) is rejected', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Preparing' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('12. Invalid status transition: Accepted to Rejected is rejected', async () => {
    const order = await createMockOrder({ status: 'Accepted', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Rejected' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('13. Invalid status transition: Terminal orders (Delivered, Rejected, Cancelled) cannot be transitioned', async () => {
    const deliveredOrder = await createMockOrder({ status: 'Delivered', restaurantId: restaurant1.id });
    const rejectedOrder = await createMockOrder({ status: 'Rejected', restaurantId: restaurant1.id });
    const cancelledOrder = await createMockOrder({ status: 'Cancelled', restaurantId: restaurant1.id });

    for (const ord of [deliveredOrder, rejectedOrder, cancelledOrder]) {
      const res = await fetch(`${baseUrl}/${ord.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({ status: 'Accepted' }),
      });

      assert.equal(res.status, 400, `Expected 400 for status ${ord.status}`);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');
    }
  });

  test('14. Unauthorized restaurant owner cannot update status of another restaurant order', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    const res = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner2Token}`,
      },
      body: JSON.stringify({ status: 'Accepted' }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('15. Customer and Delivery roles cannot modify restaurant order status', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    for (const token of [customerToken, deliveryToken]) {
      const res = await fetch(`${baseUrl}/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Accepted' }),
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN');
    }
  });

  test('16. Unauthenticated requests are rejected with HTTP 401 UNAUTHORIZED', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    // Missing token on status update
    const res1 = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Accepted' }),
    });
    assert.equal(res1.status, 401);

    // Missing token on incoming orders listing
    const res2 = await fetch(`${baseUrl}/restaurant/${restaurant1.id}`);
    assert.equal(res2.status, 401);

    // Missing token on order details
    const res3 = await fetch(`${baseUrl}/${order.id}`);
    assert.equal(res3.status, 401);
  });

  test('17. Concurrent conflicting status changes: atomic serialization prevents contradictory state transitions', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    // Launch simultaneous Accept and Reject requests
    const [resAccept, resReject] = await Promise.all([
      fetch(`${baseUrl}/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({ status: 'Accepted' }),
      }),
      fetch(`${baseUrl}/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({ status: 'Rejected' }),
      }),
    ]);

    const statuses = [resAccept.status, resReject.status];
    // Exactly one should succeed with 200, the other must fail with 400 INVALID_STATE_TRANSITION
    assert.ok(statuses.includes(200), 'One request must succeed with HTTP 200');
    assert.ok(statuses.includes(400), 'Conflicting request must fail with HTTP 400');

    const finalOrder = await orderRepository.findById(order.id);
    assert.ok(
      finalOrder.status === 'Accepted' || finalOrder.status === 'Rejected',
      'Final status must be one of the attempted terminal/accepted states'
    );
  });

  test('18. Order immutability: customer, restaurant, items, pricing, delivery address remain unchanged after updates', async () => {
    const originalOrder = await createMockOrder({
      status: 'Placed',
      restaurantId: restaurant1.id,
      customerName: 'Priya Sharma',
      customerPhone: '+91 98765 33333',
      restaurantName: 'Khazana Kitchen',
      pricing: { subtotal: 70000, deliveryFee: 4000, tax: 3500, total: 77500 },
      deliveryAddress: { street: '45 Lake View Road', city: 'Bengaluru', pincode: '560001' },
    });

    const res = await fetch(`${baseUrl}/${originalOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 'Accepted' }),
    });

    assert.equal(res.status, 200);

    const saved = await orderRepository.findById(originalOrder.id);
    assert.equal(saved.status, 'Accepted');
    // Ensure all critical immutable fields survived untouched
    assert.equal(saved.id, originalOrder.id);
    assert.equal(saved.customerId, originalOrder.customerId);
    assert.equal(saved.customerName, originalOrder.customerName);
    assert.equal(saved.customerPhone, originalOrder.customerPhone);
    assert.equal(saved.restaurantId, originalOrder.restaurantId);
    assert.equal(saved.restaurantName, originalOrder.restaurantName);
    assert.deepEqual(saved.items, originalOrder.items);
    assert.deepEqual(saved.pricing, originalOrder.pricing);
    assert.deepEqual(saved.deliveryAddress, originalOrder.deliveryAddress);
    assert.equal(saved.timestamps.createdAt, originalOrder.timestamps.createdAt);
  });

  test('19. Payload validation: Missing, non-string, or empty status returns HTTP 400 VALIDATION_ERROR', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    // Missing status
    const resEmpty = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(resEmpty.status, 400);
    const bodyEmpty = await resEmpty.json();
    assert.equal(bodyEmpty.error.code, 'VALIDATION_ERROR');

    // Non-string status
    const resNumber = await fetch(`${baseUrl}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ status: 123 }),
    });
    assert.equal(resNumber.status, 400);
    const bodyNumber = await resNumber.json();
    assert.equal(bodyNumber.error.code, 'VALIDATION_ERROR');
  });

  test('20. Status validation: Disallowed restaurant status targets return HTTP 400 INVALID_STATE_TRANSITION', async () => {
    const order = await createMockOrder({ status: 'Placed', restaurantId: restaurant1.id });

    // Status belongs to delivery or customer (Delivered, Cancelled, Picked Up)
    for (const target of ['Delivered', 'Cancelled', 'Picked Up', 'Out for Delivery', 'UnknownState']) {
      const res = await fetch(`${baseUrl}/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({ status: target }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');
    }
  });
});

