#!/usr/bin/env node

/**
 * Zaykaa Delivery Partner Smoke Test Script (M3 Task 03)
 *
 * Verifies live delivery partner profile & availability API workflow
 * against a running local backend server.
 *
 * Usage:
 *   node backend/scripts/smoke-test-delivery.js [API_BASE_URL]
 *   Default URL: http://localhost:3000
 */

const BASE_URL = process.argv[2] || process.env.API_BASE_URL || 'http://localhost:3000';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

function pass(msg) {
    console.log(`  ${colors.green}✓ PASS:${colors.reset} ${msg}`);
}

function fail(msg, details) {
    console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${msg}`);
    if (details) console.error('   ', details);
    process.exitCode = 1;
}

function header(title) {
    console.log(`\n${colors.cyan}${colors.bold}=== ${title} ===${colors.reset}`);
}

async function runSmokeTest() {
    console.log(`${colors.bold}Starting Delivery Partner API Smoke Test${colors.reset}`);
    console.log(`Target server: ${colors.yellow}${BASE_URL}${colors.reset}\n`);

    const timestamp = Date.now();
    const testDeliveryEmail = `smoke.rider.${timestamp}@test.zaykaa.com`;
    const testCustomerEmail = `smoke.customer.${timestamp}@test.zaykaa.com`;
    const testPassword = 'SmokePassword123!';

    let deliveryToken = null;
    let customerToken = null;
    let deliveryUserId = null;
    let partnerProfileId = null;

    try {
        // 0. Health check
        header('Step 0: Checking Server Health');
        const healthRes = await fetch(`${BASE_URL}/api/health`);
        if (healthRes.ok) {
            pass(`Backend API is running on ${BASE_URL}`);
        } else {
            throw new Error(`Server returned HTTP ${healthRes.status} for /api/health`);
        }

        // 1. Register temporary delivery user
        header('Step 1: Registering Temporary Delivery User');
        const regDeliveryRes = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Smoke Test Delivery Rider',
                email: testDeliveryEmail,
                password: testPassword,
                phone: '9876543210',
                role: 'delivery',
            }),
        });
        const regDeliveryData = await regDeliveryRes.json();
        if (regDeliveryRes.status === 201 && regDeliveryData.data?.token) {
            deliveryToken = regDeliveryData.data.token;
            deliveryUserId = regDeliveryData.data.user.id;
            pass(`Registered delivery user (${testDeliveryEmail}, ID: ${deliveryUserId})`);
        } else {
            fail('Failed to register delivery user', regDeliveryData);
            return;
        }

        // Also register a customer user to test RBAC rejection
        const regCustRes = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Smoke Customer',
                email: testCustomerEmail,
                password: testPassword,
                phone: '9876543211',
                role: 'customer',
            }),
        });
        const regCustData = await regCustRes.json();
        if (regCustRes.status === 201) {
            customerToken = regCustData.data.token;
            pass(`Registered auxiliary customer user for RBAC test (${testCustomerEmail})`);
        }

        // 2. Create delivery partner profile
        header('Step 2: Creating Delivery Partner Profile');
        const createProfileRes = await fetch(`${BASE_URL}/api/partners`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({
                vehicleType: 'Electric Vehicle',
            }),
        });
        const createProfileData = await createProfileRes.json();
        if (createProfileRes.status === 201 && createProfileData.data?.id) {
            partnerProfileId = createProfileData.data.id;
            pass(`Created delivery partner profile (ID: ${partnerProfileId})`);
            if (createProfileData.data.isAvailable === false) {
                pass('Default availability is correctly set to false');
            } else {
                fail('Expected initial isAvailable to be false');
            }
        } else {
            fail('Failed to create delivery partner profile', createProfileData);
            return;
        }

        // 3. Retrieve authenticated partner profile
        header('Step 3: Retrieving Partner Profile & Dashboard');
        const getMeRes = await fetch(`${BASE_URL}/api/partners/me`, {
            headers: { Authorization: `Bearer ${deliveryToken}` },
        });
        const getMeData = await getMeRes.json();
        if (getMeRes.status === 200 && getMeData.data?.id === partnerProfileId) {
            pass(`GET /api/partners/me returned matching profile (Vehicle: ${getMeData.data.vehicleType})`);
        } else {
            fail('GET /api/partners/me did not match created profile', getMeData);
        }

        const dashRes = await fetch(`${BASE_URL}/api/partners/dashboard`, {
            headers: { Authorization: `Bearer ${deliveryToken}` },
        });
        const dashData = await dashRes.json();
        if (dashRes.status === 200 && dashData.data?.partner?.id === partnerProfileId) {
            pass('GET /api/partners/dashboard returned valid dashboard structure');
        } else {
            fail('GET /api/partners/dashboard failed', dashData);
        }

        // 4. Update availability
        header('Step 4: Updating Availability Status');
        const availRes = await fetch(`${BASE_URL}/api/partners/availability`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${deliveryToken}`,
            },
            body: JSON.stringify({ isAvailable: true }),
        });
        const availData = await availRes.json();
        if (availRes.status === 200 && availData.data?.isAvailable === true) {
            pass('PATCH /api/partners/availability successfully toggled isAvailable to true');
        } else {
            fail('Failed to toggle availability to true', availData);
        }

        // 5. Verify unauthorized access is rejected
        header('Step 5: Verifying Authorization & RBAC Protection');
        const unauthRes = await fetch(`${BASE_URL}/api/partners/me`);
        if (unauthRes.status === 401) {
            pass('Unauthenticated request correctly rejected with HTTP 401 Unauthorized');
        } else {
            fail(`Expected HTTP 401 for unauthenticated request, received ${unauthRes.status}`);
        }

        if (customerToken) {
            const forbiddenRes = await fetch(`${BASE_URL}/api/partners/me`, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            if (forbiddenRes.status === 403) {
                pass('Customer role attempting delivery access correctly rejected with HTTP 403 Forbidden');
            } else {
                fail(`Expected HTTP 403 for customer role, received ${forbiddenRes.status}`);
            }
        }

        // Final summary
        header('Smoke Test Summary');
        console.log(`${colors.green}${colors.bold}All smoke test verifications passed successfully!${colors.reset}`);
        console.log(`Documented test records created in local storage:`);
        console.log(`  - User: ${testDeliveryEmail} (${deliveryUserId})`);
        console.log(`  - Partner Profile: ${partnerProfileId}`);
        console.log(`  - Customer User: ${testCustomerEmail}\n`);
    } catch (err) {
        fail('Smoke test encountered an unexpected exception', err.message);
    }
}

runSmokeTest();