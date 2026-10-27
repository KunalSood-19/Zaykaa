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
import { MenuRepository } from '../src/modules/menus/menu.repository.js';
import { MenuService } from '../src/modules/menus/menu.service.js';
import { MenuController } from '../src/modules/menus/menu.controller.js';
import { createMenuRouter } from '../src/modules/menus/menu.routes.js';

// Test JWT Secret setup
process.env.JWT_SECRET = 'test_jwt_secret_for_menu_crud_tests_5432109876';
process.env.JWT_EXPIRES_IN = '24h';

describe('Restaurant Menu CRUD API & Service Tests (M2 Prompt 2.1)', () => {
    let tempDir;
    let isolatedStore;
    let authRepository;
    let authService;
    let authMiddleware;
    let restaurantRepository;
    let restaurantService;
    let restaurantController;
    let menuRepository;
    let menuService;
    let menuController;
    let server;
    let baseUrl;

    let owner1Token;
    let owner1User;
    let owner2Token;
    let owner2User;
    let customerToken;
    let deliveryToken;

    let restaurant1;
    let restaurant2;

    const validMenuItemPayload = {
        name: 'Butter Chicken',
        description: 'Tender chicken pieces cooked in a buttery tomato gravy',
        category: 'Main Course',
        price: 35000, // 350 INR in paise
        imageUrl: '/assets/images/menu/butter-chicken.jpg',
        isAvailable: true,
    };

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-menu-test-'));
        isolatedStore = new JsonStore(tempDir);

        authRepository = new AuthRepository(isolatedStore);
        authService = new AuthService(authRepository);
        authMiddleware = createAuthMiddleware(authRepository);

        restaurantRepository = new RestaurantRepository(isolatedStore);
        restaurantService = new RestaurantService(restaurantRepository);
        restaurantController = new RestaurantController(restaurantService);

        menuRepository = new MenuRepository(isolatedStore);
        menuService = new MenuService(menuRepository, restaurantRepository);
        menuController = new MenuController(menuService);

        const menuRouter = createMenuRouter(menuController, authMiddleware);
        const restaurantRouter = createRestaurantRouter(
            restaurantController,
            authMiddleware,
            menuRouter
        );

        const app = express();
        app.use(express.json());
        app.use('/api/restaurants', restaurantRouter);

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
                baseUrl = `http://localhost:${port}/api/restaurants`;
                resolve();
            });
        });

        // Seed test users
        const owner1Reg = await authService.register({
            name: 'Owner 1',
            email: 'owner1_menu@test.com',
            password: 'OwnerPassword123!',
            phone: '+91 98765 11111',
            role: 'restaurant',
        });
        owner1Token = owner1Reg.token;
        owner1User = owner1Reg.user;

        const owner2Reg = await authService.register({
            name: 'Owner 2',
            email: 'owner2_menu@test.com',
            password: 'OwnerPassword123!',
            phone: '+91 98765 22222',
            role: 'restaurant',
        });
        owner2Token = owner2Reg.token;
        owner2User = owner2Reg.user;

        const custReg = await authService.register({
            name: 'Customer Menu',
            email: 'cust_menu@test.com',
            password: 'CustomerPassword123!',
            phone: '+91 98765 33333',
            role: 'customer',
        });
        customerToken = custReg.token;

        const delReg = await authService.register({
            name: 'Delivery Menu',
            email: 'del_menu@test.com',
            password: 'DeliveryPassword123!',
            phone: '+91 98765 44444',
            role: 'delivery',
        });
        deliveryToken = delReg.token;

        // Seed restaurants for both owners
        restaurant1 = await restaurantService.createRestaurant(owner1User.id, {
            name: 'Royal Punjab',
            description: 'North Indian cuisine',
            cuisineTypes: ['North Indian', 'Punjabi'],
            address: { street: '12 Main Rd', city: 'Amritsar', pincode: '143001' },
            phone: '+91 80 1234 5678',
            isOpen: true,
        });

        restaurant2 = await restaurantService.createRestaurant(owner2User.id, {
            name: 'Madras Cafe',
            description: 'South Indian cuisine',
            cuisineTypes: ['South Indian'],
            address: { street: '45 Anna Salai', city: 'Chennai', pincode: '600002' },
            phone: '+91 80 8765 4321',
            isOpen: true,
        });
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
        // Reset menus collection before each test
        await fs.writeFile(path.join(tempDir, 'menus.json'), '[]\n', 'utf8');
    });

    // --- 1. Menu Item Creation Tests ---

    test('1. Restaurant owner successfully creates a menu item (HTTP 201 Created)', async () => {
        const res = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });

        assert.equal(res.status, 201);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.ok(body.data.id.startsWith('item_'));
        assert.equal(body.data.restaurantId, restaurant1.id);
        assert.equal(body.data.name, 'Butter Chicken');
        assert.equal(body.data.price, 35000);
        assert.equal(body.data.isAvailable, true);
        assert.ok(body.data.createdAt);
        assert.ok(body.data.updatedAt);
    });

    test('2. Invalid create payload returns validation error (HTTP 400 VALIDATION_ERROR)', async () => {
        // Missing required name
        const invalidPayload = { ...validMenuItemPayload };
        delete invalidPayload.name;

        const res = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(invalidPayload),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
        assert.ok(Array.isArray(body.error.details));
    });

    test('3. Unauthenticated creation is rejected (HTTP 401 UNAUTHORIZED)', async () => {
        const res = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validMenuItemPayload),
        });

        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    test('4. Customer and delivery roles cannot create menu items (HTTP 403 FORBIDDEN)', async () => {
        // Customer
        const resCust = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${customerToken}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        assert.equal(resCust.status, 403);
        const bodyCust = await resCust.json();
        assert.equal(bodyCust.error.code, 'FORBIDDEN');

        // Delivery agent
        const resDel = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        assert.equal(resDel.status, 403);
        const bodyDel = await resDel.json();
        assert.equal(bodyDel.error.code, 'FORBIDDEN');
    });

    test('5. Non-owner cannot create menu items for another restaurant (HTTP 403 FORBIDDEN)', async () => {
        // Owner 2 tries to add item to Restaurant 1 (owned by Owner 1)
        const res = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner2Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });

        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    // --- 2. Menu Listing & Isolation Tests ---

    test('6. Public menu listing works without authentication (HTTP 200 OK)', async () => {
        // Seed an item in restaurant1
        await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });

        // Public list request
        const res = await fetch(`${baseUrl}/${restaurant1.id}/menu`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.data.length, 1);
        assert.equal(body.data[0].name, 'Butter Chicken');
        assert.equal(body.data[0].restaurantId, restaurant1.id);
    });

    test('7. Menu items are strictly isolated by restaurant', async () => {
        // Add item to restaurant1
        await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({
                name: 'Dal Makhani',
                category: 'Main Course',
                price: 25000,
            }),
        });

        // Add item to restaurant2
        await fetch(`${baseUrl}/${restaurant2.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner2Token}`,
            },
            body: JSON.stringify({
                name: 'Masala Dosa',
                category: 'Breakfast',
                price: 12000,
            }),
        });

        // List restaurant1 menu
        const res1 = await fetch(`${baseUrl}/${restaurant1.id}/menu`);
        const body1 = await res1.json();
        assert.equal(body1.data.length, 1);
        assert.equal(body1.data[0].name, 'Dal Makhani');

        // List restaurant2 menu
        const res2 = await fetch(`${baseUrl}/${restaurant2.id}/menu`);
        const body2 = await res2.json();
        assert.equal(body2.data.length, 1);
        assert.equal(body2.data[0].name, 'Masala Dosa');
    });

    // --- 3. Update & Ownership Tests ---

    test('8. Owner can update a menu item (HTTP 200 OK)', async () => {
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();

        const updateRes = await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({
                name: 'Butter Chicken Special',
                price: 39000,
            }),
        });

        assert.equal(updateRes.status, 200);
        const body = await updateRes.json();
        assert.equal(body.success, true);
        assert.equal(body.data.name, 'Butter Chicken Special');
        assert.equal(body.data.price, 39000);
        assert.equal(body.data.category, 'Main Course'); // Unchanged field preserved
        assert.equal(body.data.id, created.data.id);
    });

    test('9. Non-owner cannot update a menu item (HTTP 403 FORBIDDEN)', async () => {
        // Created by owner 1
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();

        // Owner 2 attempts update on restaurant1
        const updateRes = await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner2Token}`,
            },
            body: JSON.stringify({ name: 'Hacked Dish' }),
        });

        assert.equal(updateRes.status, 403);
        const body = await updateRes.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('10. Item from another restaurant cannot be updated through the wrong restaurant URL (HTTP 404 NOT_FOUND)', async () => {
        // Create item in restaurant 1
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();

        // Attempt to update item1 using restaurant 2's URL with owner 2's credentials
        const updateRes = await fetch(`${baseUrl}/${restaurant2.id}/menu/${created.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner2Token}`,
            },
            body: JSON.stringify({ name: 'Tampered Dish' }),
        });

        assert.equal(updateRes.status, 404);
        const body = await updateRes.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('11. Price validation rejects invalid amounts (floating-point, negative, zero, string)', async () => {
        // 1. Decimal price rejected
        const resDecimal = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({
                ...validMenuItemPayload,
                price: 350.50,
            }),
        });
        assert.equal(resDecimal.status, 400);

        // 2. Negative price rejected
        const resNegative = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({
                ...validMenuItemPayload,
                price: -100,
            }),
        });
        assert.equal(resNegative.status, 400);

        // 3. Zero price rejected (must be positive integer in paise)
        const resZero = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({
                ...validMenuItemPayload,
                price: 0,
            }),
        });
        assert.equal(resZero.status, 400);

        // 4. String price rejected
        const resString = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({
                ...validMenuItemPayload,
                price: '35000',
            }),
        });
        assert.equal(resString.status, 400);
    });

    test('12. Availability can be toggled via PUT and PATCH endpoints', async () => {
        // Create item
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();
        assert.equal(created.data.isAvailable, true);

        // 1. Toggle via PATCH /availability
        const patchRes = await fetch(
            `${baseUrl}/${restaurant1.id}/menu/${created.data.id}/availability`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${owner1Token}`,
                },
                body: JSON.stringify({ isAvailable: false }),
            }
        );
        assert.equal(patchRes.status, 200);
        const patchBody = await patchRes.json();
        assert.equal(patchBody.success, true);
        assert.equal(patchBody.data.isAvailable, false);

        // 2. Toggle back via PUT /:itemId
        const putRes = await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });
        assert.equal(putRes.status, 200);
        const putBody = await putRes.json();
        assert.equal(putBody.data.isAvailable, true);

        // 3. Reject invalid availability value
        const invalidPatchRes = await fetch(
            `${baseUrl}/${restaurant1.id}/menu/${created.data.id}/availability`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${owner1Token}`,
                },
                body: JSON.stringify({ isAvailable: 'not_a_boolean' }),
            }
        );
        assert.equal(invalidPatchRes.status, 400);
    });

    // --- 4. Delete & Referential Integrity Tests ---

    test('13. Owner can delete a menu item (HTTP 200 OK)', async () => {
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();

        const delRes = await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${owner1Token}`,
            },
        });

        assert.equal(delRes.status, 200);
        const delBody = await delRes.json();
        assert.equal(delBody.success, true);
        assert.equal(delBody.message, 'Menu item deleted');

        // Subsequent retrieval returns 404
        const getRes = await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`);
        assert.equal(getRes.status, 404);
    });

    test('14. Non-owner cannot delete a menu item (HTTP 403 FORBIDDEN)', async () => {
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();

        // Owner 2 attempts deletion
        const delRes = await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${owner2Token}`,
            },
        });

        assert.equal(delRes.status, 403);
        const delBody = await delRes.json();
        assert.equal(delBody.success, false);
        assert.equal(delBody.error.code, 'FORBIDDEN');
    });

    test('15. Missing restaurant or item returns documented HTTP 404 NOT_FOUND', async () => {
        // Missing restaurant on list
        const res1 = await fetch(`${baseUrl}/rst_nonexistent_9999/menu`);
        assert.equal(res1.status, 404);
        const body1 = await res1.json();
        assert.equal(body1.error.code, 'NOT_FOUND');

        // Missing restaurant on create
        const res2 = await fetch(`${baseUrl}/rst_nonexistent_9999/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        assert.equal(res2.status, 404);

        // Missing item on update
        const res3 = await fetch(`${baseUrl}/${restaurant1.id}/menu/item_nonexistent_8888`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({ name: 'Nonexistent' }),
        });
        assert.equal(res3.status, 404);

        // Missing item on delete
        const res4 = await fetch(`${baseUrl}/${restaurant1.id}/menu/item_nonexistent_8888`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${owner1Token}`,
            },
        });
        assert.equal(res4.status, 404);
    });

    test('16. Persistence remains correct after create, update, and delete directly in storage', async () => {
        // 1. Create item
        const createRes = await fetch(`${baseUrl}/${restaurant1.id}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify(validMenuItemPayload),
        });
        const created = await createRes.json();

        // Verify storage has the item
        const verifyStore = new JsonStore(tempDir);
        let diskItems = await verifyStore.readCollection('menus');
        assert.equal(diskItems.length, 1);
        assert.equal(diskItems[0].id, created.data.id);
        assert.equal(diskItems[0].price, 35000);

        // 2. Update item
        await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${owner1Token}`,
            },
            body: JSON.stringify({ price: 42000 }),
        });

        diskItems = await verifyStore.readCollection('menus');
        assert.equal(diskItems[0].price, 42000);
        assert.equal(diskItems[0].id, created.data.id);
        assert.equal(diskItems[0].restaurantId, restaurant1.id);

        // 3. Delete item
        await fetch(`${baseUrl}/${restaurant1.id}/menu/${created.data.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${owner1Token}`,
            },
        });

        diskItems = await verifyStore.readCollection('menus');
        assert.equal(diskItems.length, 0);
    });
});