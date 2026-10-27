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
import {
    validateDeliveryPartnerCreate,
    validateDeliveryPartnerUpdate,
} from '../src/modules/delivery/delivery.validation.js';

process.env.JWT_SECRET = 'test_secret_delivery_val_extra_12345678';
process.env.JWT_EXPIRES_IN = '24h';

describe('Delivery Partner Validation Tests — Extra Coverage (M3 Task 03)', () => {
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

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-del-val-extra-'));
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

        const reg = await authService.register({
            name: 'Validation Rider',
            email: 'val.rider@test.com',
            password: 'RiderPassword123!',
            phone: '+91 98765 77771',
            role: 'delivery',
        });
        deliveryToken = reg.token;
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

    // --- Direct Unit Validation Function Tests ---

    test('1. validateDeliveryPartnerCreate rejects non-object, null, array, and primitive inputs', () => {
        const invalidInputs = [null, undefined, [], 'string', 123, true];
        for (const input of invalidInputs) {
            const result = validateDeliveryPartnerCreate(input);
            assert.equal(result.valid, false);
            assert.equal(result.errors[0].field, 'root');
        }
    });

    test('2. validateDeliveryPartnerUpdate rejects non-object, null, array, and primitive inputs', () => {
        const invalidInputs = [null, undefined, [], 'string', 123, true];
        for (const input of invalidInputs) {
            const result = validateDeliveryPartnerUpdate(input);
            assert.equal(result.valid, false);
            assert.equal(result.errors[0].field, 'root');
        }
    });

    test('3. validateDeliveryPartnerCreate enforces vehicleType non-null string enum', () => {
        const badVehicleTypes = [null, undefined, 12345, {}, [], '', '   ', 'Truck', 'Auto-Rickshaw', 'Drone'];
        for (const vt of badVehicleTypes) {
            const result = validateDeliveryPartnerCreate({ vehicleType: vt });
            assert.equal(result.valid, false);
            const vehicleError = result.errors.find((e) => e.field === 'vehicleType');
            assert.ok(vehicleError, `Expected vehicleType error for value: ${JSON.stringify(vt)}`);
        }
    });

    test('4. validateDeliveryPartnerUpdate rejects unknown vehicleType when provided', () => {
        const result = validateDeliveryPartnerUpdate({ vehicleType: 'Hoverboard' });
        assert.equal(result.valid, false);
        assert.ok(result.errors.find((e) => e.field === 'vehicleType'));
    });

    test('5. validateDeliveryPartnerCreate rejects unknown fields', () => {
        const result = validateDeliveryPartnerCreate({
            vehicleType: 'Motorcycle',
            licensePlate: 'KA-01-AB-1234',
            experienceYears: 3,
        });
        assert.equal(result.valid, false);
        assert.ok(result.errors.find((e) => e.field === 'licensePlate'));
        assert.ok(result.errors.find((e) => e.field === 'experienceYears'));
    });

    test('6. validateDeliveryPartnerUpdate rejects unknown fields', () => {
        const result = validateDeliveryPartnerUpdate({
            vehicleType: 'Scooter',
            customNotes: 'Fast rider',
        });
        assert.equal(result.valid, false);
        assert.ok(result.errors.find((e) => e.field === 'customNotes'));
    });

    test('7. validateDeliveryPartnerCreate rejects every protected field', () => {
        const protectedFields = ['id', 'userId', 'activeOrderId', 'totalDeliveries', 'createdAt', 'updatedAt'];
        for (const field of protectedFields) {
            const payload = { vehicleType: 'Motorcycle', [field]: 'arbitrary_value' };
            const result = validateDeliveryPartnerCreate(payload);
            assert.equal(result.valid, false);
            assert.ok(result.errors.find((e) => e.field === field));
        }
    });

    test('8. validateDeliveryPartnerUpdate rejects every protected field', () => {
        const protectedFields = ['id', 'userId', 'activeOrderId', 'totalDeliveries', 'createdAt', 'updatedAt'];
        for (const field of protectedFields) {
            const payload = { vehicleType: 'Motorcycle', [field]: 'arbitrary_value' };
            const result = validateDeliveryPartnerUpdate(payload);
            assert.equal(result.valid, false);
            assert.ok(result.errors.find((e) => e.field === field));
        }
    });

    test('9. validateDeliveryPartnerUpdate rejects empty object payload ({})', () => {
        const result = validateDeliveryPartnerUpdate({});
        assert.equal(result.valid, false);
        assert.equal(result.errors[0].field, 'root');
        assert.match(result.errors[0].message, /at least one field/i);
    });

    test('10. validateDeliveryPartnerCreate and update reject non-boolean isAvailable', () => {
        const badBooleans = ['true', 'false', 1, 0, null, {}, []];
        for (const val of badBooleans) {
            const createRes = validateDeliveryPartnerCreate({ vehicleType: 'Bicycle', isAvailable: val });
            assert.equal(createRes.valid, false);
            assert.ok(createRes.errors.find((e) => e.field === 'isAvailable'));

            const updateRes = validateDeliveryPartnerUpdate({ isAvailable: val });
            assert.equal(updateRes.valid, false);
            assert.ok(updateRes.errors.find((e) => e.field === 'isAvailable'));
        }
    });

    // --- HTTP Integration Validation Tests ---

    test('11. HTTP POST /api/partners returns HTTP 400 VALIDATION_ERROR on malformed JSON payload', async () => {
        const res = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Submarine' }),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
        assert.ok(Array.isArray(body.error.details));
    });

    test('12. HTTP PUT /api/partners/profile returns HTTP 400 VALIDATION_ERROR on empty payload', async () => {
        // Seed profile first
        await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });

        const res = await fetch(`${baseUrl}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({}),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    test('13. HTTP PATCH /api/partners/availability returns HTTP 400 on non-boolean availability payload', async () => {
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
            body: JSON.stringify({ isAvailable: 'online' }),
        });

        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
    });
});