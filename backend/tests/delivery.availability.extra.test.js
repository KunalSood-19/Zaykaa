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

process.env.JWT_SECRET = 'test_secret_delivery_avail_extra_77777777';
process.env.JWT_EXPIRES_IN = '24h';

describe('Delivery Partner Availability State Machine Tests — Extra Coverage (M3 Task 03)', () => {
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

    let deliveryToken;
    let deliveryUser;

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-del-avail-extra-'));
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

        // Error handler
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => {
            const statusCode = err.statusCode || err.status || 500;
            res.status(statusCode).json({
                success: false,
                error: {
                    code: err.code || 'INTERNAL_SERVER_ERROR',
                    message: err.message || 'Error',
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

        const reg = await authService.register({
            name: 'State Rider',
            email: 'state.rider@test.com',
            password: 'RiderPassword123!',
            phone: '+91 98765 44441',
            role: 'delivery',
        });
        deliveryToken = reg.token;
        deliveryUser = reg.user;
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
        await fs.writeFile(path.join(tempDir, 'delivery_partners.json'), '[]\n', 'utf8');
    });

    test('1. Transition from Unavailable to Available succeeds', async () => {
        // Starts unavailable by default
        await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });

        const res = await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.isAvailable, true);
    });

    test('2. Transition from Available to Unavailable succeeds', async () => {
        // Create partner
        await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });

        // Make available
        await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });

        // Transition back to unavailable
        const res = await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: false }),
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.isAvailable, false);
    });

    test('3. Repeated idempotent availability toggles (true -> true, false -> false) succeed without error', async () => {
        await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Scooter' }),
        });

        // Already false, toggle false again
        const res1 = await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: false }),
        });
        assert.equal(res1.status, 200);

        // Toggle true
        await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });

        // Toggle true again
        const res2 = await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });
        assert.equal(res2.status, 200);
        const body2 = await res2.json();
        assert.equal(body2.data.isAvailable, true);
    });

    test('4. Active-order restriction blocks PATCH /availability when activeOrderId is present', async () => {
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const created = await createRes.json();

        // Simulate active order assigned
        await deliveryRepository.update(created.data.id, {
            activeOrderId: 'ord_active_order_888',
            isAvailable: false,
        });

        const res = await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error.code, 'ACTIVE_ORDER_RESTRICTION');
    });

    test('5. Attempt to bypass active-order restriction via PUT /api/partners/profile is rejected', async () => {
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const created = await createRes.json();

        // Assign active order
        await deliveryRepository.update(created.data.id, {
            activeOrderId: 'ord_active_order_999',
            isAvailable: false,
        });

        // Attempt to bypass via PUT /profile
        const res = await fetch(`${baseUrl}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error.code, 'ACTIVE_ORDER_RESTRICTION');
    });

    test('6. Attempt to bypass active-order restriction via PUT /api/partners/:id is rejected', async () => {
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const created = await createRes.json();

        // Assign active order
        await deliveryRepository.update(created.data.id, {
            activeOrderId: 'ord_active_order_101',
            isAvailable: false,
        });

        // Attempt to bypass via PUT /:id
        const res = await fetch(`${baseUrl}/${created.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error.code, 'ACTIVE_ORDER_RESTRICTION');
    });

    test('7. Partner on active order can still explicitly set isAvailable: false without error', async () => {
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const created = await createRes.json();

        await deliveryRepository.update(created.data.id, {
            activeOrderId: 'ord_active_order_202',
            isAvailable: false,
        });

        const res = await fetch(`${baseUrl}/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: false }),
        });

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.isAvailable, false);
    });
});