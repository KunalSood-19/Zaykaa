import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateMenuItemCreate,
    validateMenuItemUpdate,
} from '../src/modules/menus/menu.validation.js';

const validCreatePayload = {
    name: 'Paneer Butter Masala',
    description: 'Cottage cheese cubes simmered in a rich tomato, butter, and cashew gravy.',
    category: 'Main Course',
    price: 28000, // 280 INR in paise
    imageUrl: '/assets/images/menu/paneer-butter-masala.jpg',
    isAvailable: true,
};

test('1. Valid menu item creation passes validation', () => {
    const result = validateMenuItemCreate(validCreatePayload);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});

test('2. Missing or invalid name is rejected', () => {
    // Missing name
    const missing = { ...validCreatePayload };
    delete missing.name;
    const resMissing = validateMenuItemCreate(missing);
    assert.equal(resMissing.valid, false);
    assert.ok(resMissing.errors.some((e) => e.field === 'name'));

    // Too short (< 2 chars)
    const tooShort = { ...validCreatePayload, name: 'A' };
    const resShort = validateMenuItemCreate(tooShort);
    assert.equal(resShort.valid, false);
    assert.ok(resShort.errors.some((e) => e.field === 'name'));

    // Too long (> 80 chars)
    const tooLong = { ...validCreatePayload, name: 'A'.repeat(81) };
    const resLong = validateMenuItemCreate(tooLong);
    assert.equal(resLong.valid, false);
    assert.ok(resLong.errors.some((e) => e.field === 'name'));

    // Non-string
    const nonString = { ...validCreatePayload, name: 12345 };
    const resNonString = validateMenuItemCreate(nonString);
    assert.equal(resNonString.valid, false);
    assert.ok(resNonString.errors.some((e) => e.field === 'name'));

    // Empty whitespace
    const emptyWhite = { ...validCreatePayload, name: '   ' };
    const resEmpty = validateMenuItemCreate(emptyWhite);
    assert.equal(resEmpty.valid, false);
    assert.ok(resEmpty.errors.some((e) => e.field === 'name'));
});

test('3. Missing or invalid category is rejected', () => {
    // Missing category
    const missing = { ...validCreatePayload };
    delete missing.category;
    const resMissing = validateMenuItemCreate(missing);
    assert.equal(resMissing.valid, false);
    assert.ok(resMissing.errors.some((e) => e.field === 'category'));

    // Empty string
    const empty = { ...validCreatePayload, category: '   ' };
    const resEmpty = validateMenuItemCreate(empty);
    assert.equal(resEmpty.valid, false);
    assert.ok(resEmpty.errors.some((e) => e.field === 'category'));

    // Non-string
    const nonString = { ...validCreatePayload, category: ['Main Course'] };
    const resNonString = validateMenuItemCreate(nonString);
    assert.equal(resNonString.valid, false);
    assert.ok(resNonString.errors.some((e) => e.field === 'category'));

    // Too long (> 50 chars)
    const tooLong = { ...validCreatePayload, category: 'C'.repeat(51) };
    assert.equal(validateMenuItemCreate(tooLong).valid, false);
});

test('4. Valid positive integer price in paise is accepted', () => {
    const validPrices = [1, 100, 28000, 150000];

    for (const price of validPrices) {
        const res = validateMenuItemCreate({ ...validCreatePayload, price });
        assert.equal(res.valid, true);
        assert.deepEqual(res.errors, []);
    }
});

test('5. Zero, negative, decimal, string, NaN, and infinite price are rejected', () => {
    const invalidPrices = [
        0, // zero
        -100, // negative
        -28000, // negative paise
        280.5, // decimal
        99.99, // decimal
        '28000', // string
        '500', // string
        NaN, // NaN
        Infinity, // Infinity
        -Infinity, // -Infinity
        null, // null
        undefined, // undefined
    ];

    for (const price of invalidPrices) {
        const payload = { ...validCreatePayload, price };
        const res = validateMenuItemCreate(payload);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.field === 'price'));
    }
});

test('6. Optional description validation', () => {
    // Omitted description is valid
    const omitted = { ...validCreatePayload };
    delete omitted.description;
    assert.equal(validateMenuItemCreate(omitted).valid, true);

    // Valid description string
    const validDesc = { ...validCreatePayload, description: 'Freshly baked tandoori roti.' };
    assert.equal(validateMenuItemCreate(validDesc).valid, true);

    // Description too long (> 250 chars)
    const tooLong = { ...validCreatePayload, description: 'D'.repeat(251) };
    const resLong = validateMenuItemCreate(tooLong);
    assert.equal(resLong.valid, false);
    assert.ok(resLong.errors.some((e) => e.field === 'description'));

    // Non-string description
    const nonString = { ...validCreatePayload, description: 12345 };
    assert.equal(validateMenuItemCreate(nonString).valid, false);
});

test('7. Invalid image URL rejection', () => {
    // Invalid protocol
    const ftp = { ...validCreatePayload, imageUrl: 'ftp://example.com/dish.jpg' };
    const resFtp = validateMenuItemCreate(ftp);
    assert.equal(resFtp.valid, false);
    assert.ok(resFtp.errors.some((e) => e.field === 'imageUrl'));

    // Non-string
    const boolUrl = { ...validCreatePayload, imageUrl: true };
    assert.equal(validateMenuItemCreate(boolUrl).valid, false);

    // Empty string
    const emptyUrl = { ...validCreatePayload, imageUrl: '   ' };
    assert.equal(validateMenuItemCreate(emptyUrl).valid, false);

    // Valid URLs pass
    assert.equal(
        validateMenuItemCreate({ ...validCreatePayload, imageUrl: 'https://images.unsplash.com/dish.jpg' }).valid,
        true
    );
    assert.equal(
        validateMenuItemCreate({ ...validCreatePayload, imageUrl: '/assets/images/menu/naan.jpg' }).valid,
        true
    );
});

test('8. Boolean isAvailable validation', () => {
    // Omitted isAvailable defaults cleanly (valid)
    const omitted = { ...validCreatePayload };
    delete omitted.isAvailable;
    assert.equal(validateMenuItemCreate(omitted).valid, true);

    // true is valid
    assert.equal(validateMenuItemCreate({ ...validCreatePayload, isAvailable: true }).valid, true);

    // false is valid
    assert.equal(validateMenuItemCreate({ ...validCreatePayload, isAvailable: false }).valid, true);

    // Non-boolean is rejected
    const nonBool = { ...validCreatePayload, isAvailable: 'true' };
    const res = validateMenuItemCreate(nonBool);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.field === 'isAvailable'));
});

test('9. Valid partial updates', () => {
    // Update price only
    const updatePrice = validateMenuItemUpdate({ price: 32000 });
    assert.equal(updatePrice.valid, true);
    assert.deepEqual(updatePrice.errors, []);

    // Update isAvailable to false
    const updateAvailable = validateMenuItemUpdate({ isAvailable: false });
    assert.equal(updateAvailable.valid, true);
    assert.deepEqual(updateAvailable.errors, []);

    // Update name and category
    const updateMultiple = validateMenuItemUpdate({
        name: 'Kadhai Paneer',
        category: 'Chef Specials',
    });
    assert.equal(updateMultiple.valid, true);
    assert.deepEqual(updateMultiple.errors, []);
});

test('10. Empty or invalid partial updates', () => {
    // Empty update object
    const emptyUpdate = validateMenuItemUpdate({});
    assert.equal(emptyUpdate.valid, false);
    assert.ok(emptyUpdate.errors.some((e) => e.field === 'root'));

    // Invalid price in update
    const invalidPrice = validateMenuItemUpdate({ price: -500 });
    assert.equal(invalidPrice.valid, false);
    assert.ok(invalidPrice.errors.some((e) => e.field === 'price'));

    // Invalid isAvailable in update
    const invalidBool = validateMenuItemUpdate({ isAvailable: 1 });
    assert.equal(invalidBool.valid, false);
    assert.ok(invalidBool.errors.some((e) => e.field === 'isAvailable'));

    // Invalid name in update
    const invalidName = validateMenuItemUpdate({ name: '' });
    assert.equal(invalidName.valid, false);
    assert.ok(invalidName.errors.some((e) => e.field === 'name'));
});

test('11. Protected fields rejected in create and update', () => {
    const protectedFields = ['id', 'restaurantId', 'createdAt', 'updatedAt'];

    for (const field of protectedFields) {
        // In create
        const createWithProt = {
            ...validCreatePayload,
            [field]: 'protected-value-123',
        };
        const resCreate = validateMenuItemCreate(createWithProt);
        assert.equal(resCreate.valid, false);
        assert.ok(resCreate.errors.some((e) => e.field === field));

        // In update
        const updateWithProt = {
            price: 30000,
            [field]: 'protected-value-123',
        };
        const resUpdate = validateMenuItemUpdate(updateWithProt);
        assert.equal(resUpdate.valid, false);
        assert.ok(resUpdate.errors.some((e) => e.field === field));
    }
});

test('12. Unknown fields rejected in create and update', () => {
    // Unknown in create
    const createUnknown = { ...validCreatePayload, calories: 450 };
    const resCreate = validateMenuItemCreate(createUnknown);
    assert.equal(resCreate.valid, false);
    assert.ok(resCreate.errors.some((e) => e.field === 'calories'));

    // Unknown in update
    const updateUnknown = { price: 30000, spiceLevel: 'Hot' };
    const resUpdate = validateMenuItemUpdate(updateUnknown);
    assert.equal(resUpdate.valid, false);
    assert.ok(resUpdate.errors.some((e) => e.field === 'spiceLevel'));
});

test('13. Malformed inputs handled safely without throwing', () => {
    const malformedInputs = [null, undefined, 12345, 'some string', true, []];

    for (const input of malformedInputs) {
        const resCreate = validateMenuItemCreate(input);
        assert.equal(resCreate.valid, false);
        assert.ok(resCreate.errors.length > 0);

        const resUpdate = validateMenuItemUpdate(input);
        assert.equal(resUpdate.valid, false);
        assert.ok(resUpdate.errors.length > 0);
    }
});

test('14. Input object remains unchanged (immutability)', () => {
    const frozenPayload = Object.freeze({
        name: 'Butter Roti',
        category: 'Breads',
        price: 3500,
        isAvailable: true,
    });

    assert.doesNotThrow(() => {
        const resCreate = validateMenuItemCreate(frozenPayload);
        assert.equal(resCreate.valid, true);

        const resUpdate = validateMenuItemUpdate(frozenPayload);
        assert.equal(resUpdate.valid, true);
    });
});