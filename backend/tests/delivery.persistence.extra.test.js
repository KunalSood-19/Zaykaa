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

process.env.JWT_SECRET = 'test_secret_delivery_persist_extra_55555555';
process.env.JWT_EXPIRES_IN = '24h';

describe('Delivery Partner Persistence & Concurrency Tests — Extra Coverage (M3 Task 03)', () => {
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
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-del-persist-extra-'));
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
            name: 'Persistence Rider',
            email: 'persist.rider@test.com',
            password: 'RiderPassword123!',
            phone: '+91 98765 99991',
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

    test('1. Profile creation writes formatted JSON directly to disk with canonical schema', async () => {
        const res = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Scooter' }),
        });

        assert.equal(res.status, 201);
        const body = await res.json();

        // Verify raw file contents on filesystem
        const rawFile = await fs.readFile(path.join(tempDir, 'delivery_partners.json'), 'utf8');
        const parsed = JSON.parse(rawFile);

        assert.equal(parsed.length, 1);
        const record = parsed[0];
        assert.equal(record.id, body.data.id);
        assert.equal(record.userId, deliveryUser.id);
        assert.equal(record.vehicleType, 'Scooter');
        assert.equal(record.isAvailable, false);
        assert.equal(record.activeOrderId, null);
        assert.equal(record.totalDeliveries, 0);
        assert.ok(record.createdAt);
        assert.ok(record.updatedAt);
    });

    test('2. Profile update mutates disk record while strictly preserving immutable fields', async () => {
        // Create partner
        const createRes = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });
        const created = await createRes.json();
        const originalCreatedAt = created.data.createdAt;

        // Small delay to ensure timestamp progression
        await new Promise((r) => setTimeout(r, 10));

        // Update vehicle
        const updateRes = await fetch(`${baseUrl}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Bicycle' }),
        });
        assert.equal(updateRes.status, 200);

        // Read directly from disk
        const diskRecords = JSON.parse(
            await fs.readFile(path.join(tempDir, 'delivery_partners.json'), 'utf8')
        );
        assert.equal(diskRecords.length, 1);
        const updated = diskRecords[0];

        assert.equal(updated.id, created.data.id);
        assert.equal(updated.userId, deliveryUser.id);
        assert.equal(updated.vehicleType, 'Bicycle');
        assert.equal(updated.createdAt, originalCreatedAt);
        assert.ok(updated.updatedAt >= originalCreatedAt);
    });

    test('3. Duplicate profile creation rejection does not corrupt or duplicate disk data', async () => {
        // First creation
        await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Motorcycle' }),
        });

        // Duplicate attempt
        const resDup = await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ vehicleType: 'Scooter' }),
        });
        assert.equal(resDup.status, 409);

        // Disk inspection
        const diskRecords = JSON.parse(
            await fs.readFile(path.join(tempDir, 'delivery_partners.json'), 'utf8')
        );
        assert.equal(diskRecords.length, 1);
        assert.equal(diskRecords[0].vehicleType, 'Motorcycle'); // Original unmutated
    });

    test('4. High concurrency: 12 simultaneous registration requests create exactly 1 disk record without corruption', async () => {
        const requests = Array.from({ length: 12 }).map((_, i) =>
            fetch(`${baseUrl}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${deliveryToken}`,
                },
                body: JSON.stringify({
                    vehicleType: i % 2 === 0 ? 'Scooter' : 'Motorcycle',
                }),
            })
        );

        const responses = await Promise.all(requests);
        const statuses = responses.map((r) => r.status);

        const successCount = statuses.filter((s) => s === 201).length;
        const conflictCount = statuses.filter((s) => s === 409).length;

        assert.equal(successCount, 1, 'Exactly one concurrent request succeeds');
        assert.equal(conflictCount, 11, 'All other concurrent requests return 409 Conflict');

        // Verify valid JSON and exactly 1 record on disk
        const diskRecords = JSON.parse(
            await fs.readFile(path.join(tempDir, 'delivery_partners.json'), 'utf8')
        );
        assert.equal(diskRecords.length, 1);
    });
});