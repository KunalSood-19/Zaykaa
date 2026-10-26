import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateRestaurantCreate,
    validateRestaurantUpdate,
} from '../src/modules/restaurants/restaurant.validation.js';

const validCreatePayload = {
    name: 'Spice Symphony',
    description: 'Authentic North Indian & Tandoori specialties',
    cuisineTypes: ['North Indian', 'Mughlai', 'Biryani'],
    address: {
        street: '42 Outer Ring Road, Indiranagar',
        city: 'Bengaluru',
        pincode: '560038',
    },
    phone: '+91 80 4123 4567',
    imageUrl: '/assets/images/restaurants/spice-symphony.jpg',
    isOpen: true,
};

test('1. Valid restaurant creation passes validation', () => {
    const result = validateRestaurantCreate(validCreatePayload);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});

test('2. Missing or invalid restaurant name is rejected', () => {
    // Missing name
    const missing = { ...validCreatePayload };
    delete missing.name;
    const resMissing = validateRestaurantCreate(missing);
    assert.equal(resMissing.valid, false);
    assert.ok(resMissing.errors.some((e) => e.field === 'name'));

    // Too short (< 3 chars)
    const tooShort = { ...validCreatePayload, name: 'AB' };
    const resShort = validateRestaurantCreate(tooShort);
    assert.equal(resShort.valid, false);
    assert.ok(resShort.errors.some((e) => e.field === 'name'));

    // Non-string
    const nonString = { ...validCreatePayload, name: 12345 };
    const resNonString = validateRestaurantCreate(nonString);
    assert.equal(resNonString.valid, false);
    assert.ok(resNonString.errors.some((e) => e.field === 'name'));
});

test('3. Invalid cuisine types are rejected', () => {
    // Missing
    const missing = { ...validCreatePayload };
    delete missing.cuisineTypes;
    assert.equal(validateRestaurantCreate(missing).valid, false);

    // Empty array
    const empty = { ...validCreatePayload, cuisineTypes: [] };
    const resEmpty = validateRestaurantCreate(empty);
    assert.equal(resEmpty.valid, false);
    assert.ok(resEmpty.errors.some((e) => e.field === 'cuisineTypes'));

    // Non-array
    const notArray = { ...validCreatePayload, cuisineTypes: 'North Indian' };
    assert.equal(validateRestaurantCreate(notArray).valid, false);

    // Array with empty strings
    const emptyStrings = { ...validCreatePayload, cuisineTypes: ['North Indian', '   '] };
    const resEmptyStr = validateRestaurantCreate(emptyStrings);
    assert.equal(resEmptyStr.valid, false);
    assert.ok(resEmptyStr.errors.some((e) => e.field.startsWith('cuisineTypes[')));
});

test('4. Invalid address structure or missing subfields are rejected', () => {
    // Missing address object
    const missing = { ...validCreatePayload };
    delete missing.address;
    assert.equal(validateRestaurantCreate(missing).valid, false);

    // Non-object address
    const stringAddr = { ...validCreatePayload, address: 'Bengaluru' };
    assert.equal(validateRestaurantCreate(stringAddr).valid, false);

    // Missing street
    const noStreet = {
        ...validCreatePayload,
        address: { city: 'Bengaluru', pincode: '560038' },
    };
    const resNoStreet = validateRestaurantCreate(noStreet);
    assert.equal(resNoStreet.valid, false);
    assert.ok(resNoStreet.errors.some((e) => e.field === 'address.street'));

    // Missing city
    const noCity = {
        ...validCreatePayload,
        address: { street: '42 MG Road', pincode: '560038' },
    };
    const resNoCity = validateRestaurantCreate(noCity);
    assert.equal(resNoCity.valid, false);
    assert.ok(resNoCity.errors.some((e) => e.field === 'address.city'));
});

test('5. Invalid pincodes are rejected', () => {
    // Too short
    const shortPin = {
        ...validCreatePayload,
        address: { ...validCreatePayload.address, pincode: '5600' },
    };
    assert.equal(validateRestaurantCreate(shortPin).valid, false);

    // Contains letters
    const letterPin = {
        ...validCreatePayload,
        address: { ...validCreatePayload.address, pincode: '56003A' },
    };
    assert.equal(validateRestaurantCreate(letterPin).valid, false);

    // Starting with 0 (invalid Indian postal code)
    const zeroPin = {
        ...validCreatePayload,
        address: { ...validCreatePayload.address, pincode: '012345' },
    };
    assert.equal(validateRestaurantCreate(zeroPin).valid, false);
});

test('6. Invalid phone numbers are rejected', () => {
    // Too short
    const shortPhone = { ...validCreatePayload, phone: '12345' };
    assert.equal(validateRestaurantCreate(shortPhone).valid, false);

    // Non-numeric letters
    const letterPhone = { ...validCreatePayload, phone: 'phone-number' };
    assert.equal(validateRestaurantCreate(letterPhone).valid, false);

    // Non-string
    const numberPhone = { ...validCreatePayload, phone: 9876543210 };
    assert.equal(validateRestaurantCreate(numberPhone).valid, false);
});

test('7. Invalid image URLs are rejected', () => {
    // Invalid protocol
    const ftpUrl = { ...validCreatePayload, imageUrl: 'ftp://example.com/image.jpg' };
    const resFtp = validateRestaurantCreate(ftpUrl);
    assert.equal(resFtp.valid, false);
    assert.ok(resFtp.errors.some((e) => e.field === 'imageUrl'));

    // Non-string
    const boolUrl = { ...validCreatePayload, imageUrl: true };
    assert.equal(validateRestaurantCreate(boolUrl).valid, false);

    // Empty string
    const emptyUrl = { ...validCreatePayload, imageUrl: '   ' };
    assert.equal(validateRestaurantCreate(emptyUrl).valid, false);
});

test('8. Valid partial updates pass validation', () => {
    // Update name only
    const updateName = validateRestaurantUpdate({ name: 'Royal Spice Symphony' });
    assert.equal(updateName.valid, true);
    assert.deepEqual(updateName.errors, []);

    // Update isOpen status only
    const updateStatus = validateRestaurantUpdate({ isOpen: false });
    assert.equal(updateStatus.valid, true);

    // Update address partially
    const updateAddress = validateRestaurantUpdate({
        address: { city: 'Mumbai', pincode: '400001' },
    });
    assert.equal(updateAddress.valid, true);

    // Update multiple fields
    const multiUpdate = validateRestaurantUpdate({
        name: 'New Name',
        phone: '+91 99887 76655',
        isOpen: true,
    });
    assert.equal(multiUpdate.valid, true);
});

test('9. Invalid partial updates are rejected', () => {
    // Empty update object (must provide at least one field)
    const emptyUpdate = validateRestaurantUpdate({});
    assert.equal(emptyUpdate.valid, false);
    assert.ok(emptyUpdate.errors.some((e) => e.field === 'root'));

    // Invalid name in update
    const invalidName = validateRestaurantUpdate({ name: 'X' });
    assert.equal(invalidName.valid, false);
    assert.ok(invalidName.errors.some((e) => e.field === 'name'));

    // Invalid isOpen type
    const invalidIsOpen = validateRestaurantUpdate({ isOpen: 'true' });
    assert.equal(invalidIsOpen.valid, false);
    assert.ok(invalidIsOpen.errors.some((e) => e.field === 'isOpen'));

    // Empty cuisineTypes array
    const emptyCuisine = validateRestaurantUpdate({ cuisineTypes: [] });
    assert.equal(emptyCuisine.valid, false);
});

test('10. Protected fields are rejected in create and update', () => {
    const protectedFields = ['id', 'ownerId', 'createdAt', 'updatedAt'];

    for (const field of protectedFields) {
        // In create
        const createWithProtected = {
            ...validCreatePayload,
            [field]: 'custom-value-123',
        };
        const resCreate = validateRestaurantCreate(createWithProtected);
        assert.equal(resCreate.valid, false);
        assert.ok(resCreate.errors.some((e) => e.field === field));

        // In update
        const updateWithProtected = {
            name: 'Valid Name',
            [field]: 'custom-value-123',
        };
        const resUpdate = validateRestaurantUpdate(updateWithProtected);
        assert.equal(resUpdate.valid, false);
        assert.ok(resUpdate.errors.some((e) => e.field === field));
    }
});

test('11. Unknown fields are rejected in create and update', () => {
    // Unknown top-level field in create
    const createUnknown = { ...validCreatePayload, extraRating: 4.8 };
    const resCreate = validateRestaurantCreate(createUnknown);
    assert.equal(resCreate.valid, false);
    assert.ok(resCreate.errors.some((e) => e.field === 'extraRating'));

    // Unknown top-level field in update
    const updateUnknown = { name: 'Valid Name', discountCode: 'OFFER50' };
    const resUpdate = validateRestaurantUpdate(updateUnknown);
    assert.equal(resUpdate.valid, false);
    assert.ok(resUpdate.errors.some((e) => e.field === 'discountCode'));

    // Unknown field inside address
    const addressUnknown = {
        address: { street: '123 Main St', landmark: 'Near Metro' },
    };
    const resAddr = validateRestaurantUpdate(addressUnknown);
    assert.equal(resAddr.valid, false);
    assert.ok(resAddr.errors.some((e) => e.field === 'address.landmark'));
});

test('12. Malformed input is handled safely without throwing or mutating input', () => {
    const inputs = [null, undefined, 12345, 'string', true, []];

    for (const input of inputs) {
        const resCreate = validateRestaurantCreate(input);
        assert.equal(resCreate.valid, false);
        assert.ok(resCreate.errors.length > 0);

        const resUpdate = validateRestaurantUpdate(input);
        assert.equal(resUpdate.valid, false);
        assert.ok(resUpdate.errors.length > 0);
    }

    // Ensure input immutability: deep freeze payload and validate
    const frozenPayload = Object.freeze({
        name: 'Frozen Kitchen',
        cuisineTypes: Object.freeze(['Biryani']),
        address: Object.freeze({
            street: '12 Ice Lane',
            city: 'Shimla',
            pincode: '171001',
        }),
        phone: '+91 98765 43210',
    });

    assert.doesNotThrow(() => {
        const res = validateRestaurantCreate(frozenPayload);
        assert.equal(res.valid, true);
    });
});