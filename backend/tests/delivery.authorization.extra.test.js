import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JsonStore } from '../src/utils/jsonStore.js';
import { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { createAuthMiddleware } from '../src/middleware/auth.middleware.js';
import { DeliveryRepository } from '../src/modules/delivery/delivery.repository.js';
import { DeliveryService } from '../src/modules/delivery/delivery.service.js';
import { DeliveryController } from '../src/modules/delivery/delivery.controller.js';
import { createDeliveryRouter } from '../src/modules/delivery/delivery.routes.js';

const TEST_SECRET = 'test_secret_delivery_auth_extra_987654321';
process.env.JWT_SECRET = TEST_SECRET;
process.env.JWT_EXPIRES_IN = '24h';

describe('Delivery Partner Authorization & Ownership Tests — Extra Coverage (M3 Task 03)', () => {
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

    let deliveryToken1;
    let deliveryToken2;
    let customerToken;
    let restaurantToken;

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-del-auth-extra-'));
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

        // Seed test users
        const del1 = await authService.register({
            name: 'Driver Alpha',
            email: 'alpha@delivery.com',
            password: 'AlphaPassword123!',
            phone: '+91 98765 88881',
            role: 'delivery',
        });
        deliveryToken1 = del1.token;

        const del2 = await authService.register({
            name: 'Driver Beta',
            email: 'beta@delivery.com',
            password: 'BetaPassword123!',
            phone: '+91 98765 88882',
            role: 'delivery',
        });
        deliveryToken2 = del2.token;

        const cust = await authService.register({
            name: 'Customer Charlie',
            email: 'charlie@customer.com',
            password: 'CharliePassword123!',
            phone: '+91 98765 88883',
            role: 'customer',
        });
        customerToken = cust.token;

        const rest = await authService.register({
            name: 'Restaurant Delta',
            email: 'delta@restaurant.com',
            password: 'DeltaPassword123!',
            phone: '+91 98765 88884',
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
        await fs.writeFile(path.join(tempDir, 'delivery_partners.json'), '[]\n', 'utf8');
    });

    // --- 1. Missing and Invalid Tokens ---

    test('1. Requests missing Authorization header are rejected across endpoints (HTTP 401 UNAUTHORIZED)', async () => {
        const endpoints = [
            { method: 'POST', path: '' },
            { method: 'GET', path: '/me' },
            { method: 'GET', path: '/dashboard' },
            { method: 'PUT', path: '/profile' },
            { method: 'PATCH', path: '/availability' },
        ];

        for (const ep of endpoints) {
            const res = await fetch(`${baseUrl}${ep.path}`, {
                method: ep.method,
                headers: { 'Content-Type': 'application/json' },
                ...(ep.method !== 'GET' ? { body: JSON.stringify({ vehicleType: 'Scooter' }) } : {}),
            });

            assert.equal(res.status, 401, `Expected 401 for ${ep.method} ${ep.path}`);
            const body = await res.json();
            assert.equal(body.error.code, 'UNAUTHORIZED');
        }
    });

    test('2. Tampered or wrong-signature JWT is rejected (HTTP 401 UNAUTHORIZED)', async () => {
        const wrongSignatureToken = jwt.sign(
            { userId: 'usr_fake_123', role: 'delivery' },
            'completely_wrong_secret_key'
        );

        const res = await fetch(`${baseUrl}/me`, {
            headers: { Authorization: `Bearer ${wrongSignatureToken}` },
        });

        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    test('3. Expired JWT is rejected (HTTP 401 UNAUTHORIZED)', async () => {
        const expiredToken = jwt.sign(
            { userId: 'usr_fake_123', role: 'delivery' },
            TEST_SECRET,
            { expiresIn: '-1s' }
        );

        const res = await fetch(`${baseUrl}/dashboard`, {
            headers: { Authorization: `Bearer ${expiredToken}` },
        });

        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.error.code, 'UNAUTHORIZED');
        assert.match(body.error.message, /expired/i);
    });

    // --- 2. Wrong Role Authorization ---

    test('4. Customer role attempting delivery endpoints receives HTTP 403 FORBIDDEN', async () => {
        const testCases = [
            { method: 'POST', path: '', body: { vehicleType: 'Motorcycle' } },
            { method: 'GET', path: '/me' },
            { method: 'GET', path: '/dashboard' },
            { method: 'PATCH', path: '/availability', body: { isAvailable: true } },
            { method: 'PUT', path: '/profile', body: { vehicleType: 'Scooter' } },
        ];

        for (const tc of testCases) {
            const res = await fetch(`${baseUrl}${tc.path}`, {
                method: tc.method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${customerToken}`,
                },
                ...(tc.body ? { body: JSON.stringify(tc.body) } : {}),
            });

            assert.equal(res.status, 403, `Expected 403 for customer on ${tc.method} ${tc.path}`);
            const body = await res.json();
            assert.equal(body.error.code, 'FORBIDDEN');
        }
    });

    test('5. Restaurant role attempting delivery endpoints receives HTTP 403 FORBIDDEN', async () => {
        const testCases = [
            { method: 'POST', path: '', body: { vehicleType: 'Bicycle' } },
            { method: 'GET', path: '/dashboard' },
            { method: 'PATCH', path: '/availability', body: { isAvailable: true } },
        ];

        for (const tc of testCases) {
            const res = await fetch(`${baseUrl}${tc.path}`, {
                method: tc.method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${restaurantToken}`,
                },
                ...(tc.body ? { body: JSON.stringify(tc.body) } : {}),
            });

            assert.equal(res.status, 403, `Expected 403 for restaurant on ${tc.method} ${tc.path}`);
            const body = await res.json();
            assert.equal(body.error.code, 'FORBIDDEN');
        }
    });

    // --- 3. Cross-Partner Ownership Security ---

    test('6. Partner Beta cannot update Partner Alpha profile via ID endpoint (HTTP 403 FORBIDDEN)', async () => {
        // Partner Alpha creates profile
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken1}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const createdAlpha = await createRes.json();

        // Partner Beta tries to update Partner Alpha's profile by ID
        const updateRes = await fetch(`${baseUrl}/${createdAlpha.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken2}`,
            },
            body: JSON.stringify({ vehicleType: 'Scooter' }),
        });

        assert.equal(updateRes.status, 403);
        const body = await updateRes.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('7. Partner Beta cannot inspect Partner Alpha profile via direct ID endpoint (HTTP 403 FORBIDDEN)', async () => {
        // Partner Alpha creates profile
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken1}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const createdAlpha = await createRes.json();

        // Partner Beta tries to read Partner Alpha's profile by ID
        const getRes = await fetch(`${baseUrl}/${createdAlpha.data.id}`, {
            headers: { Authorization: `Bearer ${deliveryToken2}` },
        });

        assert.equal(getRes.status, 403);
        const body = await getRes.json();
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('8. Partner Alpha can inspect and update their own profile via direct ID endpoint (HTTP 200 OK)', async () => {
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken1}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const createdAlpha = await createRes.json();

        // Alpha reads own ID
        const getRes = await fetch(`${baseUrl}/${createdAlpha.data.id}`, {
            headers: { Authorization: `Bearer ${deliveryToken1}` },
        });
        assert.equal(getRes.status, 200);

        // Alpha updates own ID
        const putRes = await fetch(`${baseUrl}/${createdAlpha.data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken1}`,
            },
            body: JSON.stringify({ vehicleType: 'Electric Vehicle' }),
        });
        assert.equal(putRes.status, 200);
        const putBody = await putRes.json();
        assert.equal(putBody.data.vehicleType, 'Electric Vehicle');
    });
});