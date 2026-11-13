import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js';
import { readJson, writeJson } from '../src/utils/jsonStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

let server;
let baseUrl;

describe('Stage 7 — Zaykaa Backend Integration & Regression Testing', () => {
  let backupCustomers;
  let backupOrders;
  let backupRestaurants;
  let backupMenus;

  let existingCustAOrderId;

  before(async () => {
    // 1. Snapshot original data files to guarantee test idempotency
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

    // 3. Create a baseline order for cust_8829
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-customer-id': 'cust_8829'
      },
      body: JSON.stringify({
        restaurantId: 'rest_001',
        items: [{ itemId: 'menu_12', quantity: 1 }],
        deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
      })
    });
    const body = await res.json();
    existingCustAOrderId = body.data?.id;
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

    // Clean up temporary files if created
    const tempFiles = ['temp_test_corrupt.json', 'temp_concurrent.json'];
    for (const f of tempFiles) {
      try {
        await fs.unlink(path.resolve(DATA_DIR, f));
      } catch {
        // Ignore
      }
    }
  });

  describe('1. Full Customer REST API Regression Suite', () => {
    it('GET /api/restaurants should return 200 with standard envelope and pagination metadata', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants?page=1&limit=2`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length <= 2);
      assert.equal(body.meta.page, 1);
      assert.equal(body.meta.limit, 2);
      assert.ok(typeof body.meta.total === 'number');
    });

    it('GET /api/restaurants/:id should return 404 RESTAURANT_NOT_FOUND for non-existent restaurant', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_invalid_9999`);
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'RESTAURANT_NOT_FOUND');
    });

    it('GET /api/restaurants/:id/menu should filter by category and exclude out-of-stock items by default', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_001/menu?category=Main%20Course`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.categories.length > 0);
      assert.equal(body.data.categories[0].name.toLowerCase(), 'main course');

      // Verify no unavailable items are returned in customer menu view
      for (const cat of body.data.categories) {
        for (const item of cat.items) {
          assert.equal(item.isAvailable, true);
        }
      }
    });

    it('GET /api/customers/profile should resolve customer profile with addresses array', async () => {
      const res = await fetch(`${baseUrl}/api/customers/profile`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.id, 'cust_8829');
      assert.ok(Array.isArray(body.data.addresses));
    });

    it('PUT /api/customers/profile should validate address fields and reject non-array addresses', async () => {
      const res = await fetch(`${baseUrl}/api/customers/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          addresses: 'invalid_not_an_array'
        })
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('Malformed JSON in request body should return HTTP 400 with standardized error code', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: '{ malformed json body syntax error'
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'INVALID_JSON_BODY');
    });
  });

  describe('2. Order Creation Edge Cases & Server-Side Pricing', () => {
    it('should reject fractional/floating-point quantities (e.g. 1.5)', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_12', quantity: 1.5 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.ok(body.error.message.includes('integer between 1 and 20'));
    });

    it('should reject quantities exceeding maximum limit of 20', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_12', quantity: 21 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('should consolidate duplicate item entries in items array and compute authoritative pricing', async () => {
      // 2x Paneer Butter Masala (280 each = 560) + 3x Paneer Butter Masala (280 each = 840)
      // Total 5x = 1400. Tax = round(1400 * 0.05) = 70. Delivery = 40. Grand total = 1510.
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [
            { itemId: 'menu_12', quantity: 2 },
            { itemId: 'menu_12', quantity: 3 }
          ],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });
      assert.equal(res.status, 201);

      const body = await res.json();
      assert.equal(body.success, true);
      const order = body.data;

      // Consolidated into a single line item
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].itemId, 'menu_12');
      assert.equal(order.items[0].quantity, 5);
      assert.equal(order.pricing.subtotal, 1400);
      assert.equal(order.pricing.tax, 70);
      assert.equal(order.pricing.deliveryFee, 40);
      assert.equal(order.pricing.total, 1510);
    });

    it('should reject invalid PIN code formats (must be exactly 6 digits)', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_12', quantity: 1 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '56010' } // 5 digits!
        })
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.ok(body.error.message.includes('6-digit'));
    });
  });

  describe('3. Customer Identity & Order Ownership Isolation', () => {
    let custAOrderId;
    let custBOrderId;

    before(async () => {
      // Order placed by cust_8829
      const resA = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_14', quantity: 1 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });
      const bodyA = await resA.json();
      custAOrderId = bodyA.data.id;

      // Order placed by cust_1002
      const resB = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_1002'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_14', quantity: 2 }],
          deliveryAddress: { street: '42 Indiranagar', city: 'Bengaluru', pincode: '560038' }
        })
      });
      const bodyB = await resB.json();
      custBOrderId = bodyB.data.id;
    });

    it('Customer A cannot access Customer B order details (403 FORBIDDEN_ORDER_ACCESS)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${custBOrderId}`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
    });

    it('Customer B cannot access Customer A order details (403 FORBIDDEN_ORDER_ACCESS)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${custAOrderId}`, {
        headers: { 'x-customer-id': 'cust_1002' }
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
    });

    it('Customer A cannot cancel Customer B order (403 FORBIDDEN_ORDER_ACCESS)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${custBOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({ reason: 'Attempted unauthorized cancellation' })
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
    });
  });

  describe('4. JSON Storage Engine Resilience & Concurrency', () => {
    it('readJson should return empty array fallback when parsing malformed JSON file', async () => {
      const corruptFile = 'temp_test_corrupt.json';
      const corruptPath = path.resolve(DATA_DIR, corruptFile);
      await fs.writeFile(corruptPath, '{ broken json content syntax error !!!');

      const data = await readJson(corruptFile);
      assert.deepEqual(data, []);
    });

    it('writeJson should handle concurrent overlapping writes without corruption', async () => {
      const testFile = 'temp_concurrent.json';
      await writeJson(testFile, []);

      // Dispatch 5 concurrent writes simultaneously
      const writes = Array.from({ length: 5 }, (_, idx) => {
        return writeJson(testFile, [{ writeIndex: idx, timestamp: Date.now() }]);
      });

      await Promise.all(writes);

      // Verify the final file is valid JSON and contains an array
      const finalData = await readJson(testFile);
      assert.ok(Array.isArray(finalData));
      assert.equal(finalData.length, 1);
      assert.ok(typeof finalData[0].writeIndex === 'number');
    });
  });
});
