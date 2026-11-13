import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { readJson, writeJson } from '../src/utils/jsonStorage.js';

let server;
let baseUrl;

describe('Stage 3 — Zaykaa Backend Foundation & Customer APIs', () => {
  let backupCustomers;
  let backupOrders;
  let backupRestaurants;
  let backupMenus;

  before(async () => {
    backupCustomers = await readJson('customers.json');
    backupOrders = await readJson('orders.json');
    backupRestaurants = await readJson('restaurants.json');
    backupMenus = await readJson('menus.json');

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (backupCustomers) await writeJson('customers.json', backupCustomers);
    if (backupOrders) await writeJson('orders.json', backupOrders);
    if (backupRestaurants) await writeJson('restaurants.json', backupRestaurants);
    if (backupMenus) await writeJson('menus.json', backupMenus);
  });

  describe('1. Health Check & Envelope Standards', () => {
    it('GET /api/health should return standard success envelope', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.message, 'Zaykaa API is running');
    });

    it('GET /api/unknown-endpoint should return standard error envelope with 404', async () => {
      const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.ok(body.error.message);
    });
  });

  describe('2. Restaurant Discovery APIs', () => {
    it('GET /api/restaurants should return list of restaurants with meta pagination', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length >= 3);
      assert.ok(body.meta);
      assert.equal(body.meta.page, 1);
    });

    it('GET /api/restaurants?search=spice should filter by restaurant name', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants?search=spice`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.data.some((r) => r.id === 'rest_001'));
      assert.ok(body.data.every((r) => r.name.toLowerCase().includes('spice') || r.cuisines.some((c) => c.toLowerCase().includes('spice'))));
    });

    it('GET /api/restaurants?cuisine=South%20Indian should filter by cuisine', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants?cuisine=South%20Indian`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.data.some((r) => r.id === 'rest_003'));
      assert.ok(body.data.every((r) => r.cuisines.map((c) => c.toLowerCase()).includes('south indian')));
    });

    it('GET /api/restaurants?isVeg=true should return only vegetarian restaurants', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants?isVeg=true`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.data.length > 0);
      assert.ok(body.data.every((r) => r.isVegOnly === true));
    });

    it('GET /api/restaurants?page=1&limit=2 should paginate results correctly', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants?page=1&limit=2`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.length, 2);
      assert.equal(body.meta.page, 1);
      assert.equal(body.meta.limit, 2);
      assert.ok(body.meta.total >= 4);
    });
  });

  describe('3. Restaurant Details & Menu APIs', () => {
    it('GET /api/restaurants/:id should return details for valid restaurant', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_001`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.id, 'rest_001');
      assert.equal(body.data.name, 'Spice Symphony');
      assert.ok(body.data.address);
    });

    it('GET /api/restaurants/:id should return 404 RESTAURANT_NOT_FOUND for invalid id', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_nonexistent`);
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'RESTAURANT_NOT_FOUND');
    });

    it('GET /api/restaurants/:id/menu should return categorized menu items', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_001/menu`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.restaurantId, 'rest_001');
      assert.ok(Array.isArray(body.data.categories));
      assert.ok(body.data.categories.length > 0);

      const mainCourse = body.data.categories.find((c) => c.name === 'Main Course');
      assert.ok(mainCourse);
      assert.ok(mainCourse.items.some((i) => i.itemId === 'menu_12'));
    });

    it('GET /api/restaurants/:id/menu?category=Main%20Course should filter by category', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_001/menu?category=Main%20Course`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.categories.length, 1);
      assert.equal(body.data.categories[0].name, 'Main Course');
    });

    it('GET /api/restaurants/:id/menu should exclude out-of-stock items by default', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_001/menu`);
      const body = await res.json();

      assert.equal(res.status, 200);
      const allReturnedItems = body.data.categories.flatMap((c) => c.items);
      // menu_17 is out of stock (isAvailable: false)
      const outOfStock = allReturnedItems.find((i) => i.itemId === 'menu_17');
      assert.equal(outOfStock, undefined);
    });

    it('GET /api/restaurants/:id/menu for invalid restaurant should return 404', async () => {
      const res = await fetch(`${baseUrl}/api/restaurants/rest_nonexistent/menu`);
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.error.code, 'RESTAURANT_NOT_FOUND');
    });
  });

  describe('4. Customer Identity & Profile Management', () => {
    it('GET /api/customers/profile should resolve default test customer cust_8829', async () => {
      const res = await fetch(`${baseUrl}/api/customers/profile`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.id, 'cust_8829');
      assert.equal(body.data.name, 'Tarshit Gupta');
    });

    it('GET /api/customers/profile should resolve custom x-customer-id header', async () => {
      const res = await fetch(`${baseUrl}/api/customers/profile`, {
        headers: { 'x-customer-id': 'cust_1002' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.data.id, 'cust_1002');
      assert.equal(body.data.name, 'Aarav Sharma');
    });

    it('PUT /api/customers/profile should update writable fields and prevent id tampering', async () => {
      const res = await fetch(`${baseUrl}/api/customers/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          id: 'hacked_id_attempt',
          name: 'Tarshit G. Updated',
          phone: '+91 99999 00000'
        })
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.id, 'cust_8829'); // Must remain cust_8829
      assert.equal(body.data.name, 'Tarshit G. Updated');
      assert.equal(body.data.phone, '+91 99999 00000');
    });
  });

  describe('5. Order Creation, Server-Side Pricing & Validation', () => {
    it('POST /api/orders should reject request with missing restaurantId', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ itemId: 'menu_12', quantity: 1 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('POST /api/orders should reject request with empty items array', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('POST /api/orders should reject order if restaurant is closed', async () => {
      // rest_004 is Midnight Pizzeria with isOpen: false
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest_004',
          items: [{ itemId: 'menu_12', quantity: 1 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'RESTAURANT_CLOSED');
    });

    it('POST /api/orders should reject unavailable out-of-stock menu items', async () => {
      // menu_17 is Seasonal Mango Kulfi with isAvailable: false
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_17', quantity: 1 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.error.code, 'ITEM_UNAVAILABLE');
    });

    it('POST /api/orders should reject mixed-restaurant cart items', async () => {
      // menu_12 is from rest_001, menu_21 is from rest_002
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [
            { itemId: 'menu_12', quantity: 1 },
            { itemId: 'menu_21', quantity: 1 }
          ],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.ok(body.error.message.includes('different restaurant'));
    });

    it('POST /api/orders should enforce server-side pricing and ignore client prices', async () => {
      // menu_12 is 280, menu_14 is 45
      // 2 * 280 = 560
      // 2 * 45 = 90
      // subtotal = 650
      // tax (5%) = 33
      // deliveryFee = 40
      // total = 650 + 40 + 33 = 723
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [
            { itemId: 'menu_12', quantity: 2, price: 1 }, // Client attempts ₹1
            { itemId: 'menu_14', quantity: 2, price: 5 }  // Client attempts ₹5
          ],
          pricing: {
            subtotal: 10,
            deliveryFee: 0,
            tax: 0,
            total: 10 // Client attempts ₹10 total
          },
          deliveryAddress: {
            street: '123 Tech Park Road',
            city: 'Bengaluru',
            pincode: '560100'
          }
        })
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.message, 'Order placed successfully');

      const order = body.data;
      assert.ok(order.id.startsWith('ord_'));
      assert.equal(order.customerId, 'cust_8829');
      assert.equal(order.restaurantId, 'rest_001');
      assert.equal(order.status, 'Placed');

      // Server-side authoritative pricing checks:
      assert.equal(order.pricing.subtotal, 650);
      assert.equal(order.pricing.deliveryFee, 40);
      assert.equal(order.pricing.tax, 33);
      assert.equal(order.pricing.total, 723);

      // Verify item price checks
      const item1 = order.items.find((i) => i.itemId === 'menu_12');
      assert.equal(item1.price, 280);
      assert.equal(item1.quantity, 2);
    });
  });

  describe('6. Order Retrieval, History & Access Control', () => {
    let createdOrderId;

    before(async () => {
      // Place an order as cust_8829
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
      createdOrderId = body.data.id;
    });

    it('GET /api/customers/orders should return customer order history', async () => {
      const res = await fetch(`${baseUrl}/api/customers/orders`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.some((o) => o.id === createdOrderId));
    });

    it('GET /api/orders/:id should allow owner customer to view their order', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${createdOrderId}`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.id, createdOrderId);
      assert.equal(body.data.status, 'Placed');
    });

    it('GET /api/orders/:id should return 403 FORBIDDEN_ORDER_ACCESS for unauthorized customer', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${createdOrderId}`, {
        headers: { 'x-customer-id': 'cust_1002' } // cust_1002 is not the owner!
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
    });

    it('GET /api/orders/:id should return 404 ORDER_NOT_FOUND for non-existent order', async () => {
      const res = await fetch(`${baseUrl}/api/orders/ord_nonexistent`, {
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.error.code, 'ORDER_NOT_FOUND');
    });
  });

  describe('7. Order Cancellation & Lifecycle Rules', () => {
    let orderToCancelId;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({
          restaurantId: 'rest_001',
          items: [{ itemId: 'menu_13', quantity: 1 }],
          deliveryAddress: { street: '123 Tech Park', city: 'Bengaluru', pincode: '560100' }
        })
      });
      const body = await res.json();
      orderToCancelId = body.data.id;
    });

    it('POST /api/orders/:id/cancel should reject cancellation by unauthorized user', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderToCancelId}/cancel`, {
        method: 'POST',
        headers: { 'x-customer-id': 'cust_1002' } // Different customer
      });
      assert.equal(res.status, 403);

      const body = await res.json();
      assert.equal(body.error.code, 'FORBIDDEN_ORDER_ACCESS');
    });

    it('POST /api/orders/:id/cancel should successfully cancel an order in Placed status', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderToCancelId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': 'cust_8829'
        },
        body: JSON.stringify({ reason: 'Changed mind' })
      });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'Cancelled');
      assert.equal(body.message, 'Order cancelled successfully');
    });

    it('POST /api/orders/:id/cancel should reject cancellation if order is already Cancelled', async () => {
      const res = await fetch(`${baseUrl}/api/orders/${orderToCancelId}/cancel`, {
        method: 'POST',
        headers: { 'x-customer-id': 'cust_8829' }
      });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error.code, 'ORDER_CANNOT_BE_CANCELLED');
    });
  });

  describe('8. JSON Storage Engine Resilience', () => {
    const tempFiles = [];

    after(async () => {
      const { default: fs } = await import('node:fs/promises');
      const { default: path } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const __dir = path.dirname(fileURLToPath(import.meta.url));
      const dataDir = path.resolve(__dir, '../data');

      for (const file of tempFiles) {
        try {
          await fs.unlink(path.resolve(dataDir, file));
        } catch {
          // Ignore
        }
      }
    });

    it('readJson should safely recover from missing files by initializing an empty array', async () => {
      const missingFile = `test_missing_${Date.now()}.json`;
      tempFiles.push(missingFile);
      const result = await readJson(missingFile);
      assert.deepEqual(result, []);
    });

    it('readJson should safely recover from empty/blank files', async () => {
      const blankFile = `test_blank_${Date.now()}.json`;
      tempFiles.push(blankFile);
      await writeJson(blankFile, []);
      const result = await readJson(blankFile);
      assert.deepEqual(result, []);
    });
  });
});

