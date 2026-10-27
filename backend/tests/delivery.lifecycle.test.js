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
import { DeliveryService } from '../src/modules/delivery/delivery.service.js';
import { DeliveryController } from '../src/modules/delivery/delivery.controller.js';
import { createDeliveryRouter } from '../src/modules/delivery/delivery.routes.js';
import { OrderRepository } from '../src/modules/orders/order.repository.js';
import { OrderService } from '../src/modules/orders/order.service.js';
import { OrderController } from '../src/modules/orders/order.controller.js';
import { createOrderRouter } from '../src/modules/orders/order.routes.js';

process.env.JWT_SECRET = 'test_jwt_secret_for_delivery_lifecycle_tests_12345';
process.env.JWT_EXPIRES_IN = '24h';

describe('Delivery Assignment & Order Lifecycle Tests (M2 Prompt 2.4)', () => {
  let tempDir;
  let isolatedStore;
  let authRepository;
  let authService;
  let authMiddleware;
  let restaurantRepository;
  let deliveryRepository;
  let deliveryService;
  let deliveryController;
  let orderRepository;
  let orderService;
  let orderController;
  let server;
  let baseUrlPartners;
  let baseUrlOrders;

  let restaurantUser, restaurantToken, restaurant;
  let deliveryUser1, deliveryToken1, partnerProfile1;
  let deliveryUser2, deliveryToken2, partnerProfile2;
  let deliveryUserNoProfile, deliveryTokenNoProfile;
  let customerUser, customerToken;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-deliv-lifecycle-'));
    isolatedStore = new JsonStore(tempDir);

    authRepository = new AuthRepository(isolatedStore);
    authService = new AuthService(authRepository);
    authMiddleware = createAuthMiddleware(authRepository);

    restaurantRepository = new RestaurantRepository(isolatedStore);
    deliveryRepository = new DeliveryRepository(isolatedStore);
    orderRepository = new OrderRepository(isolatedStore);

    deliveryService = new DeliveryService(deliveryRepository, orderRepository, restaurantRepository);
    deliveryController = new DeliveryController(deliveryService);

    orderService = new OrderService(orderRepository, restaurantRepository, deliveryRepository);
    orderController = new OrderController(orderService);

    const deliveryRouter = createDeliveryRouter(deliveryController, authMiddleware);
    const orderRouter = createOrderRouter(orderController, authMiddleware);

    const app = express();
    app.use(express.json());
    app.use('/api/partners', deliveryRouter);
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
        baseUrlPartners = `http://localhost:${port}/api/partners`;
        baseUrlOrders = `http://localhost:${port}/api/orders`;
        resolve();
      });
    });

    // Seed Restaurant Owner & Restaurant
    const regRest = await authService.register({
      name: 'Spice Master',
      email: 'spicemaster@zaykaa.com',
      password: 'SpicePassword123!',
      phone: '+91 98765 11223',
      role: 'restaurant',
    });
    restaurantUser = regRest.user;
    restaurantToken = regRest.token;

    restaurant = await restaurantRepository.createRestaurantWithUniqueOwner({
      ownerId: restaurantUser.id,
      name: 'Biryani Central',
      description: 'Dum cooked authentic biryanis',
      cuisineTypes: ['Biryani', 'Hyderabadi'],
      address: {
        street: '100 Food Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
      },
      phone: '+91 98765 11223',
      imageUrl: 'https://images.unsplash.com/photo-biryani',
      isOpen: true,
    });

    // Seed Delivery Partner 1
    const regDel1 = await authService.register({
      name: 'Ravi Express',
      email: 'ravi.rider@zaykaa.com',
      password: 'RiderPassword123!',
      phone: '+91 98765 44401',
      role: 'delivery',
    });
    deliveryUser1 = regDel1.user;
    deliveryToken1 = regDel1.token;

    partnerProfile1 = await deliveryRepository.createPartnerWithUniqueUser({
      userId: deliveryUser1.id,
      vehicleType: 'Motorcycle',
      isAvailable: true,
    });

    // Seed Delivery Partner 2
    const regDel2 = await authService.register({
      name: 'Sunil Fast',
      email: 'sunil.rider@zaykaa.com',
      password: 'RiderPassword123!',
      phone: '+91 98765 44402',
      role: 'delivery',
    });
    deliveryUser2 = regDel2.user;
    deliveryToken2 = regDel2.token;

    partnerProfile2 = await deliveryRepository.createPartnerWithUniqueUser({
      userId: deliveryUser2.id,
      vehicleType: 'Scooter',
      isAvailable: true,
    });

    // Seed Delivery User WITHOUT profile
    const regDelNoProfile = await authService.register({
      name: 'New Rider',
      email: 'new.rider@zaykaa.com',
      password: 'RiderPassword123!',
      phone: '+91 98765 44403',
      role: 'delivery',
    });
    deliveryUserNoProfile = regDelNoProfile.user;
    deliveryTokenNoProfile = regDelNoProfile.token;

    // Seed Customer
    const regCust = await authService.register({
      name: 'Amit Customer',
      email: 'amit.customer@zaykaa.com',
      password: 'CustomerPassword123!',
      phone: '+91 98765 88888',
      role: 'customer',
    });
    customerUser = regCust.user;
    customerToken = regCust.token;
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
    // Reset orders collection
    await isolatedStore._writeAtomic('orders', []);

    // Reset partner states to online and unassigned
    await isolatedStore._writeAtomic('delivery_partners', [
      {
        ...partnerProfile1,
        isAvailable: true,
        activeOrderId: null,
        totalDeliveries: 0,
      },
      {
        ...partnerProfile2,
        isAvailable: true,
        activeOrderId: null,
        totalDeliveries: 0,
      },
    ]);
  });

  async function createMockOrder(overrides = {}) {
    const defaultOrder = {
      customerId: customerUser.id,
      customerName: 'Amit Customer',
      customerPhone: '+91 98765 88888',
      restaurantId: restaurant.id,
      restaurantName: 'Biryani Central',
      deliveryPartnerId: null,
      status: 'Accepted',
      items: [
        {
          itemId: 'item_biryani_01',
          name: 'Chicken Dum Biryani',
          quantity: 2,
          price: 32000,
        },
      ],
      pricing: {
        subtotal: 64000,
        deliveryFee: 4000,
        tax: 3200,
        total: 71200,
      },
      deliveryAddress: {
        street: '42 Tech Avenue, Koramangala',
        city: 'Bengaluru',
        pincode: '560034',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    return orderRepository.create(defaultOrder);
  }

  test('1. Available order discovery: Partner can view available delivery orders and dashboard', async () => {
    const order1 = await createMockOrder({ status: 'Accepted' });
    const order2 = await createMockOrder({ status: 'Preparing' });

    // Test GET /api/partners/dashboard
    const dashRes = await fetch(`${baseUrlPartners}/dashboard`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(dashRes.status, 200);
    const dashBody = await dashRes.json();
    assert.equal(dashBody.success, true);
    assert.equal(dashBody.data.partner.id, partnerProfile1.id);
    assert.equal(dashBody.data.activeOrder, null);
    assert.equal(dashBody.data.availableOrders.length, 2);

    // Test GET /api/partners/orders/available
    const availRes = await fetch(`${baseUrlPartners}/orders/available`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(availRes.status, 200);
    const availBody = await availRes.json();
    assert.equal(availBody.success, true);
    assert.equal(availBody.data.length, 2);

    // Restaurant details and pickup address are present
    const first = availBody.data[0];
    assert.equal(first.restaurantName, 'Biryani Central');
    assert.ok(first.pickupAddress !== null);
    assert.equal(first.pickupAddress.city, 'Bengaluru');
    assert.equal(first.deliveryAddress.city, 'Bengaluru');
    // Sensitive customer phone is not leaked on unassigned pool
    assert.equal(first.customerPhone, undefined);
  });

  test('2. Eligibility and status filtering: Only unassigned Accepted, Preparing, Ready for Pickup orders appear', async () => {
    await createMockOrder({ status: 'Placed' }); // NOT eligible yet
    await createMockOrder({ status: 'Accepted', deliveryPartnerId: null }); // eligible
    await createMockOrder({ status: 'Preparing', deliveryPartnerId: null }); // eligible
    await createMockOrder({ status: 'Ready for Pickup', deliveryPartnerId: null }); // eligible
    await createMockOrder({ status: 'Accepted', deliveryPartnerId: partnerProfile2.id }); // already claimed
    await createMockOrder({ status: 'Picked Up', deliveryPartnerId: partnerProfile2.id }); // in transit
    await createMockOrder({ status: 'Out for Delivery', deliveryPartnerId: partnerProfile2.id }); // in transit
    await createMockOrder({ status: 'Delivered', deliveryPartnerId: partnerProfile2.id }); // terminal
    await createMockOrder({ status: 'Rejected' }); // terminal
    await createMockOrder({ status: 'Cancelled' }); // terminal

    const res = await fetch(`${baseUrlPartners}/orders/available`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 3);
    const statuses = body.data.map((o) => o.status).sort();
    assert.deepEqual(statuses, ['Accepted', 'Preparing', 'Ready for Pickup']);
  });

  test('3. Unavailable or busy partner sees an empty available orders pool', async () => {
    await createMockOrder({ status: 'Accepted' });

    // Partner 1 toggles offline
    await fetch(`${baseUrlPartners}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    });

    const res = await fetch(`${baseUrlPartners}/orders/available`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 0);
  });

  test('4. Successful order claiming: Assigns order, updates activeOrderId, and marks partner offline', async () => {
    const order = await createMockOrder({ status: 'Accepted' });

    const res = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, order.id);
    assert.equal(body.data.deliveryPartnerId, partnerProfile1.id);
    assert.equal(body.data.status, 'Accepted'); // Status remains unchanged

    // Verify partner profile state
    const meRes = await fetch(`${baseUrlPartners}/me`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    const meBody = await meRes.json();
    assert.equal(meBody.data.activeOrderId, order.id);
    assert.equal(meBody.data.isAvailable, false);

    // Active order endpoint returns the assigned order
    const activeRes = await fetch(`${baseUrlPartners}/orders/active`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    const activeBody = await activeRes.json();
    assert.equal(activeBody.data.id, order.id);
    assert.equal(activeBody.data.customerPhone, '+91 98765 88888'); // Rider can contact customer
  });

  test('5. Concurrency: Two partners racing to claim the same order - exactly one succeeds, other gets 409', async () => {
    const order = await createMockOrder({ status: 'Accepted' });

    const [res1, res2] = await Promise.all([
      fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${deliveryToken1}` },
      }),
      fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${deliveryToken2}` },
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const conflictRes = res1.status === 409 ? res1 : res2;
    const conflictBody = await conflictRes.json();
    assert.equal(conflictBody.success, false);
    assert.equal(conflictBody.error.code, 'CONFLICT');

    // Confirm stored order has the winner's partner ID
    const savedOrder = await orderRepository.findById(order.id);
    assert.ok(
      savedOrder.deliveryPartnerId === partnerProfile1.id ||
        savedOrder.deliveryPartnerId === partnerProfile2.id
    );
  });

  test('6. Concurrency: One partner racing to claim two orders - exactly one succeeds, other gets 400', async () => {
    const orderA = await createMockOrder({ status: 'Accepted' });
    const orderB = await createMockOrder({ status: 'Accepted' });

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrlPartners}/orders/${orderA.id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${deliveryToken1}` },
      }),
      fetch(`${baseUrlPartners}/orders/${orderB.id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${deliveryToken1}` },
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [200, 400]);

    const errRes = resA.status === 400 ? resA : resB;
    const errBody = await errRes.json();
    assert.equal(errBody.error.code, 'ACTIVE_ORDER_RESTRICTION');

    const meRes = await fetch(`${baseUrlPartners}/me`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    const meBody = await meRes.json();
    assert.ok(meBody.data.activeOrderId === orderA.id || meBody.data.activeOrderId === orderB.id);
  });

  test('7. Unavailable partners cannot claim orders', async () => {
    const order = await createMockOrder({ status: 'Accepted' });

    // Set partner 1 offline
    await fetch(`${baseUrlPartners}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deliveryToken1}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    });

    const res = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'PARTNER_UNAVAILABLE');
  });

  test('8. Lifecycle: Pickup transition succeeds only when status is Ready for Pickup', async () => {
    const order = await createMockOrder({ status: 'Preparing' });

    // Claim order
    await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    // Attempt pickup while still Preparing -> Rejected
    const prepPickupRes = await fetch(`${baseUrlPartners}/orders/${order.id}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(prepPickupRes.status, 400);
    const prepPickupBody = await prepPickupRes.json();
    assert.equal(prepPickupBody.error.code, 'INVALID_STATE_TRANSITION');

    // Restaurant completes preparation: Preparing -> Ready for Pickup
    await fetch(`${baseUrlOrders}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restaurantToken}`,
      },
      body: JSON.stringify({ status: 'Ready for Pickup' }),
    });

    // Pickup succeeds now: Ready for Pickup -> Picked Up
    const pickupRes = await fetch(`${baseUrlPartners}/orders/${order.id}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(pickupRes.status, 200);
    const pickupBody = await pickupRes.json();
    assert.equal(pickupBody.success, true);
    assert.equal(pickupBody.data.status, 'Picked Up');

    const saved = await orderRepository.findById(order.id);
    assert.equal(saved.status, 'Picked Up');
  });

  test('9. Lifecycle: Out for Delivery transition succeeds only when status is Picked Up', async () => {
    const order = await createMockOrder({
      status: 'Picked Up',
      deliveryPartnerId: partnerProfile1.id,
    });
    await deliveryRepository.update(partnerProfile1.id, {
      activeOrderId: order.id,
      isAvailable: false,
    });

    const res = await fetch(`${baseUrlPartners}/orders/${order.id}/out-for-delivery`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'Out for Delivery');

    const saved = await orderRepository.findById(order.id);
    assert.equal(saved.status, 'Out for Delivery');
  });

  test('10. Lifecycle: Delivery completion marks Delivered, clears activeOrderId, increments totalDeliveries, restores availability', async () => {
    const order = await createMockOrder({
      status: 'Out for Delivery',
      deliveryPartnerId: partnerProfile1.id,
    });
    await deliveryRepository.update(partnerProfile1.id, {
      activeOrderId: order.id,
      isAvailable: false,
      totalDeliveries: 3,
    });

    const res = await fetch(`${baseUrlPartners}/orders/${order.id}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'Delivered');

    // Verify partner state updated
    const partner = await deliveryRepository.findById(partnerProfile1.id);
    assert.equal(partner.activeOrderId, null);
    assert.equal(partner.totalDeliveries, 4);
    assert.equal(partner.isAvailable, true);

    // Verify delivery history contains this order
    const histRes = await fetch(`${baseUrlPartners}/orders/history`, {
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    const histBody = await histRes.json();
    assert.equal(histBody.success, true);
    assert.equal(histBody.data.length, 1);
    assert.equal(histBody.data[0].id, order.id);
  });

  test('11. Duplicate completion protection: Cannot deliver an already delivered order', async () => {
    const order = await createMockOrder({
      status: 'Delivered',
      deliveryPartnerId: partnerProfile1.id,
    });

    const res = await fetch(`${baseUrlPartners}/orders/${order.id}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('12. Cross-partner isolation: Partner 2 cannot transition Partner 1 order', async () => {
    const order = await createMockOrder({
      status: 'Ready for Pickup',
      deliveryPartnerId: partnerProfile1.id,
    });
    await deliveryRepository.update(partnerProfile1.id, {
      activeOrderId: order.id,
      isAvailable: false,
    });

    // Partner 2 attempts pickup
    const pickupRes = await fetch(`${baseUrlPartners}/orders/${order.id}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken2}` },
    });
    assert.equal(pickupRes.status, 403);
    const pickupBody = await pickupRes.json();
    assert.equal(pickupBody.error.code, 'FORBIDDEN');

    // Partner 2 attempts out-for-delivery
    const outRes = await fetch(`${baseUrlPartners}/orders/${order.id}/out-for-delivery`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken2}` },
    });
    assert.equal(outRes.status, 403);

    // Partner 2 attempts deliver
    const deliverRes = await fetch(`${baseUrlPartners}/orders/${order.id}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken2}` },
    });
    assert.equal(deliverRes.status, 403);
  });

  test('13. Unauthorized roles cannot access delivery lifecycle endpoints', async () => {
    const order = await createMockOrder({ status: 'Accepted' });

    // Customer role calling delivery endpoint
    const custRes = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(custRes.status, 403);

    // Restaurant role calling delivery endpoint
    const restRes = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${restaurantToken}` },
    });
    assert.equal(restRes.status, 403);

    // Unauthenticated request
    const unauthRes = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
    });
    assert.equal(unauthRes.status, 401);
  });

  test('14. Delivery user without profile receives 404 when attempting order operations', async () => {
    const order = await createMockOrder({ status: 'Accepted' });

    const res = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryTokenNoProfile}` },
    });
    assert.equal(res.status, 404);
  });

  test('15. Order immutability: customer, restaurant, items, pricing, deliveryAddress preserved across all transitions', async () => {
    const originalOrder = await createMockOrder({
      status: 'Ready for Pickup',
      deliveryAddress: { street: '42 Tech Avenue', city: 'Bengaluru', pincode: '560034' },
      pricing: { subtotal: 64000, deliveryFee: 4000, tax: 3200, total: 71200 },
    });

    // 1. Accept
    await fetch(`${baseUrlPartners}/orders/${originalOrder.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    // 2. Pickup
    await fetch(`${baseUrlPartners}/orders/${originalOrder.id}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    // 3. Out for delivery
    await fetch(`${baseUrlPartners}/orders/${originalOrder.id}/out-for-delivery`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    // 4. Deliver
    await fetch(`${baseUrlPartners}/orders/${originalOrder.id}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });

    const finalOrder = await orderRepository.findById(originalOrder.id);
    assert.equal(finalOrder.status, 'Delivered');
    assert.equal(finalOrder.id, originalOrder.id);
    assert.equal(finalOrder.customerId, originalOrder.customerId);
    assert.equal(finalOrder.customerName, originalOrder.customerName);
    assert.equal(finalOrder.customerPhone, originalOrder.customerPhone);
    assert.equal(finalOrder.restaurantId, originalOrder.restaurantId);
    assert.equal(finalOrder.restaurantName, originalOrder.restaurantName);
    assert.deepEqual(finalOrder.items, originalOrder.items);
    assert.deepEqual(finalOrder.pricing, originalOrder.pricing);
    assert.deepEqual(finalOrder.deliveryAddress, originalOrder.deliveryAddress);
    assert.equal(finalOrder.timestamps.createdAt, originalOrder.timestamps.createdAt);
  });

  test('16. Compatibility: Complete lifecycle from Restaurant Acceptance to Delivery Handover', async () => {
    // 1. Order placed
    const order = await createMockOrder({ status: 'Placed' });

    // 2. Restaurant accepts
    const rAcc = await fetch(`${baseUrlOrders}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restaurantToken}`,
      },
      body: JSON.stringify({ status: 'Accepted' }),
    });
    assert.equal(rAcc.status, 200);

    // 3. Restaurant starts cooking
    const rPrep = await fetch(`${baseUrlOrders}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restaurantToken}`,
      },
      body: JSON.stringify({ status: 'Preparing' }),
    });
    assert.equal(rPrep.status, 200);

    // 4. Delivery partner claims order during preparation
    const dClaim = await fetch(`${baseUrlPartners}/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(dClaim.status, 200);

    // 5. Restaurant finishes packaging: Preparing -> Ready for Pickup
    const rReady = await fetch(`${baseUrlOrders}/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restaurantToken}`,
      },
      body: JSON.stringify({ status: 'Ready for Pickup' }),
    });
    assert.equal(rReady.status, 200);

    // 6. Delivery partner picks up: Ready for Pickup -> Picked Up
    const dPickup = await fetch(`${baseUrlPartners}/orders/${order.id}/pickup`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(dPickup.status, 200);

    // 7. Delivery partner sets transit: Picked Up -> Out for Delivery
    const dOut = await fetch(`${baseUrlPartners}/orders/${order.id}/out-for-delivery`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(dOut.status, 200);

    // 8. Delivery partner marks delivered: Out for Delivery -> Delivered
    const dDeliv = await fetch(`${baseUrlPartners}/orders/${order.id}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${deliveryToken1}` },
    });
    assert.equal(dDeliv.status, 200);

    const completeOrder = await orderRepository.findById(order.id);
    assert.equal(completeOrder.status, 'Delivered');
  });
});
