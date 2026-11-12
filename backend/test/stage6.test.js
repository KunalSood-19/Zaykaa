import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { readJson, writeJson } from '../src/utils/jsonStorage.js';

let server;
let baseUrl;

describe('Stage 6 — Zaykaa Customer Order History, Details & Status Tracking', () => {
  let backupCustomers;
  let backupOrders;
  let backupRestaurants;
  let backupMenus;

  let testOrderCustA;
  let testOrderCustB;

  before(async () => {
    // 1. Take backups to ensure test isolation and idempotency
    backupCustomers = await readJson('customers.json');
    backupOrders = await readJson('orders.json');
    backupRestaurants = await readJson('restaurants.json');
    backupMenus = await readJson('menus.json');

    // 2. Start server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 3. Create test order for Customer A (cust_8829)
    const resA = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-id': 'cust_8829'
      },
      body: JSON.stringify({
        restaurantId: 'rest_001',
        items: [{ itemId: 'menu_12', quantity: 2 }], // Paneer Butter Masala
        deliveryAddress: { street: '123 Tech Park Road', city: 'Bengaluru', pincode: '560100' }
      })
    });
    const bodyA = await resA.json();
    testOrderCustA = bodyA.data;

    // 4. Create test order for Customer B (cust_1002)
    const resB = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-id': 'cust_1002'
      },
      body: JSON.stringify({
        restaurantId: 'rest_001',
        items: [{ itemId: 'menu_14', quantity: 3 }], // Butter Naan
        deliveryAddress: { street: '42 Indiranagar', city: 'Bengaluru', pincode: '560038' }
      })
    });
    const bodyB = await resB.json();
    testOrderCustB = bodyB.data;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Restore original snapshots
    if (backupCustomers) await writeJson('customers.json', backupCustomers);
    if (backupOrders) await writeJson('orders.json', backupOrders);
    if (backupRestaurants) await writeJson('restaurants.json', backupRestaurants);
    if (backupMenus) await writeJson('menus.json', backupMenus);
  });

  describe('1. Customer Order History (GET /api/customers/orders)', () => {
    it('should return standard success envelope with data array and pagination meta', async () => {
      const res = await fetch(`${baseUrl}/api/customers/orders`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.meta);
      assert.equal(typeof body.meta.page, 'number');
      assert.equal(typeof body.meta.limit, 'number');
      assert.equal(typeof body.meta.total, 'number');
    });

    it('should strictly return orders belonging to the authenticated customer (no cross-customer order leakage)', async () => {
      const resA = await fetch(`${baseUrl}/api/customers/orders`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      const bodyA = await resA.json();

      // All returned orders must belong to cust_8829
      for (const order of bodyA.data) {
        assert.equal(order.customerId, 'cust_8829');
      }

      // Customer A should see testOrderCustA, but NOT testOrderCustB
      assert.ok(bodyA.data.some((o) => o.id === testOrderCustA.id));
      assert.ok(!bodyA.data.some((o) => o.id === testOrderCustB.id));

      // Customer B should see testOrderCustB, but NOT testOrderCustA
      const resB = await fetch(`${baseUrl}/api/customers/orders`, {
        headers: { 'x-customer-id': 'cust_1002' }
      });
      const bodyB = await resB.json();
      assert.ok(bodyB.data.some((o) => o.id === testOrderCustB.id));
      assert.ok(!bodyB.data.some((o) => o.id === testOrderCustA.id));
    });

    it('should sort orders with the most recent order first', async () => {
      const res = await fetch(`${baseUrl}/api/customers/orders`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      const body = await res.json();
      assert.ok(body.data.length >= 2);

      for (let i = 0; i < body.data.length - 1; i++) {
        const timeA = new Date(body.data[i].timestamps?.createdAt || body.data[i].createdAt || 0).getTime();
        const timeB = new Date(body.data[i + 1].timestamps?.createdAt || body.data[i + 1].createdAt || 0).getTime();
        assert.ok(timeA >= timeB, `Expected order ${i} (${timeA}) to be >= order ${i + 1} (${timeB})`);
      }
    });

    it('should filter customer orders by status query parameter', async () => {
      const res = await fetch(`${baseUrl}/api/customers/orders?status=Placed`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      for (const order of body.data) {
        assert.equal(order.status, 'Placed');
      }
    });

    it('should return empty array with total 0 for customer with no orders', async () => {
      const res = await fetch(`${baseUrl}/api/customers/orders`, {
        headers: { 'x-customer-id': 'cust_new_user_without_orders' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.deepEqual(body.data, []);
      assert.equal(body.meta.total, 0);
    });
  });

  describe('2. Order Details & Ownership Enforcement (GET /api/orders/:id)', () => {
    it('should return full canonical order details for the owning customer', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${testOrderCustA.id}`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);

      const order = body.data;
      assert.equal(order.id, testOrderCustA.id);
      assert.equal(order.customerId, 'cust_8829');
      assert.equal(order.customerName, 'Tarshit Gupta');
      assert.equal(order.restaurantId, 'rest_001');
      assert.equal(order.restaurantName, 'Spice Symphony');
      assert.equal(order.status, 'Placed');
      assert.ok(Array.isArray(order.items));
      assert.ok(order.items.length > 0);
      assert.equal(order.items[0].itemId, 'menu_12');
      assert.ok(order.pricing);
      assert.equal(order.pricing.subtotal, 560);
      assert.equal(order.pricing.deliveryFee, 40);
      assert.equal(order.pricing.tax, 28);
      assert.equal(order.pricing.total, 628);
      assert.ok(order.deliveryAddress);
      assert.equal(order.deliveryAddress.city, 'Bengaluru');
      assert.ok(order.timestamps?.createdAt);
    });

    it('should reject access with 403 FORBIDDEN_ORDER_ACCESS when requesting another customer\'s order', async () => {
      // cust_1002 attempts to view testOrderCustA which belongs to cust_8829
      const res = await fetch(`${baseUrl}/api/orders/${testOrderCustA.id}`, {
        headers: { 'x-customer-id': 'cust_1002' }
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
      assert.ok(body.error.message.includes('authorization'));
    });

    it('should return 404 ORDER_NOT_FOUND when order does not exist', async () => {
      const res = await fetch(`${baseUrl}/api/orders/ord_does_not_exist_999`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'ORDER_NOT_FOUND');
    });
  });

  describe('3. Order Status Lifecycle & Customer Cancellation (POST /api/orders/:id/cancel)', () => {
    let orderToCancel;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_14', quantity: 2 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });
      const body = await res.json();
      orderToCancel = body.data;
    });

    it('should reject cancellation with 403 FORBIDDEN_ORDER_ACCESS for unauthorized user', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderToCancel.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_1002' // Unauthorized
        },
        body: JSON.stringify({ reason: 'Malicious attempt' })
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
    });

    it('should successfully cancel order when in Placed status and record cancellation reason', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderToCancel.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({ reason: 'Placed order by mistake' })
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.message, 'Order cancelled successfully');
      assert.equal(body.data.id, orderToCancel.id);
      assert.equal(body.data.status, 'Cancelled');
      assert.equal(body.data.cancellationReason, 'Placed order by mistake');

      // Verify status persisted in order repository
      const verifyRes = await fetch(`${baseUrl}/api/orders/${orderToCancel.id}`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      const verifyBody = await verifyRes.json();
      assert.equal(verifyBody.data.status, 'Cancelled');
    });

    it('should reject cancellation if order is already Cancelled (terminal state)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderToCancel.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({ reason: 'Trying to cancel again' })
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'ORDER_CANNOT_BE_CANCELLED');
    });
  });
});
