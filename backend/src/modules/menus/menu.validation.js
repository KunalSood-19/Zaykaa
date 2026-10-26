/**
 * Zaykaa Menu Item Input Validation
 *
 * Provides reusable validation for menu item creation and partial updates
 * strictly adhering to canonical data models and API contracts.
 */

const PROTECTED_FIELDS = ['id', 'restaurantId', 'createdAt', 'updatedAt'];
const ALLOWED_FIELDS = [
    'name',
    'description',
    'category',
    'price',
    'imageUrl',
    'isAvailable',
];

/**
 * Validates a positive integer price measured in paise (1 INR = 100 paise).
 * Rejects negative numbers, zero, decimals, strings, NaN, and Infinity.
 *
 * @param {any} price
 * @returns {boolean}
 */
function isValidPrice(price) {
    return (
        typeof price === 'number' &&
        Number.isInteger(price) &&
        Number.isFinite(price) &&
        price > 0
    );
}

/**
 * Validates an image URL or local static asset path.
 * Accepts relative paths (starting with /) and HTTP/HTTPS URLs.
 *
 * @param {any} url
 * @returns {boolean}
 */
function isValidImageUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.length === 0 || trimmed.length > 255) return false;
    return (
        trimmed.startsWith('/') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://')
    );
}

/**
 * Validates menu item creation payload.
 * Enforces presence and format of required fields (name, category, price in paise).
 *
 * @param {object} data
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateMenuItemCreate(data) {
    const errors = [];

    // 1. Guard against non-object or null input
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {
            valid: false,
            errors: [{ field: 'root', message: 'Input must be a valid JSON object' }],
        };
    }

    // 2. Reject protected fields
    for (const field of PROTECTED_FIELDS) {
        if (field in data) {
            errors.push({
                field,
                message: `Field '${field}' is protected and cannot be set directly`,
            });
        }
    }

    // 3. Reject unknown fields
    for (const key of Object.keys(data)) {
        if (!ALLOWED_FIELDS.includes(key) && !PROTECTED_FIELDS.includes(key)) {
            errors.push({
                field: key,
                message: `Unknown field '${key}' is not permitted`,
            });
        }
    }

    // 4. Validate 'name' (Required, string, 2–80 characters)
    if (!('name' in data) || data.name === undefined || data.name === null) {
        errors.push({ field: 'name', message: 'Menu item name is required' });
    } else if (typeof data.name !== 'string') {
        errors.push({ field: 'name', message: 'Menu item name must be a string' });
    } else if (data.name.trim().length < 2 || data.name.trim().length > 80) {
        errors.push({
            field: 'name',
            message: 'Menu item name must be between 2 and 80 characters',
        });
    }

    // 5. Validate 'description' (Optional, string, max 250 characters)
    if ('description' in data && data.description !== undefined && data.description !== null) {
        if (typeof data.description !== 'string') {
            errors.push({ field: 'description', message: 'Description must be a string' });
        } else if (data.description.trim().length > 250) {
            errors.push({
                field: 'description',
                message: 'Description cannot exceed 250 characters',
            });
        }
    }

    // 6. Validate 'category' (Required, string, 2–50 characters)
    if (!('category' in data) || data.category === undefined || data.category === null) {
        errors.push({ field: 'category', message: 'Category is required' });
    } else if (typeof data.category !== 'string') {
        errors.push({ field: 'category', message: 'Category must be a string' });
    } else if (data.category.trim().length < 2 || data.category.trim().length > 50) {
        errors.push({
            field: 'category',
            message: 'Category must be between 2 and 50 characters',
        });
    }

    // 7. Validate 'price' (Required, positive integer in paise)
    if (!('price' in data) || data.price === undefined || data.price === null) {
        errors.push({
            field: 'price',
            message: 'Price must be a positive integer in paise',
        });
    } else if (!isValidPrice(data.price)) {
        errors.push({
            field: 'price',
            message: 'Price must be a positive integer in paise',
        });
    }

    // 8. Validate 'imageUrl' (Optional, relative path or HTTP/HTTPS URL)
    if ('imageUrl' in data && data.imageUrl !== undefined && data.imageUrl !== null) {
        if (!isValidImageUrl(data.imageUrl)) {
            errors.push({
                field: 'imageUrl',
                message: 'imageUrl must be a valid relative path (starting with /) or HTTP/HTTPS URL',
            });
        }
    }

    // 9. Validate 'isAvailable' (Optional on create, must be boolean if supplied)
    if ('isAvailable' in data && data.isAvailable !== undefined && data.isAvailable !== null) {
        if (typeof data.isAvailable !== 'boolean') {
            errors.push({ field: 'isAvailable', message: 'isAvailable must be a boolean value' });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates partial menu item update payload.
 * At least one updatable field must be provided.
 *
 * @param {object} data
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateMenuItemUpdate(data) {
    const errors = [];

    // 1. Guard against non-object or null input
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {
            valid: false,
            errors: [{ field: 'root', message: 'Input must be a valid JSON object' }],
        };
    }

    // 2. Reject protected fields
    for (const field of PROTECTED_FIELDS) {
        if (field in data) {
            errors.push({
                field,
                message: `Field '${field}' is protected and cannot be modified`,
            });
        }
    }

    // 3. Reject unknown fields
    for (const key of Object.keys(data)) {
        if (!ALLOWED_FIELDS.includes(key) && !PROTECTED_FIELDS.includes(key)) {
            errors.push({
                field: key,
                message: `Unknown field '${key}' is not permitted`,
            });
        }
    }

    // 4. Must provide at least one valid updatable field
    const updatableKeys = Object.keys(data).filter((key) =>
        ALLOWED_FIELDS.includes(key)
    );

    if (updatableKeys.length === 0 && errors.length === 0) {
        return {
            valid: false,
            errors: [
                {
                    field: 'root',
                    message: 'At least one field must be provided for update',
                },
            ],
        };
    }

    // 5. Validate 'name' if present
    if ('name' in data) {
        if (typeof data.name !== 'string') {
            errors.push({ field: 'name', message: 'Menu item name must be a string' });
        } else if (data.name.trim().length < 2 || data.name.trim().length > 80) {
            errors.push({
                field: 'name',
                message: 'Menu item name must be between 2 and 80 characters',
            });
        }
    }

    // 6. Validate 'description' if present
    if ('description' in data && data.description !== null) {
        if (typeof data.description !== 'string') {
            errors.push({ field: 'description', message: 'Description must be a string' });
        } else if (data.description.trim().length > 250) {
            errors.push({
                field: 'description',
                message: 'Description cannot exceed 250 characters',
            });
        }
    }

    // 7. Validate 'category' if present
    if ('category' in data) {
        if (typeof data.category !== 'string') {
            errors.push({ field: 'category', message: 'Category must be a string' });
        } else if (data.category.trim().length < 2 || data.category.trim().length > 50) {
            errors.push({
                field: 'category',
                message: 'Category must be between 2 and 50 characters',
            });
        }
    }

    // 8. Validate 'price' if present (must be positive integer in paise)
    if ('price' in data) {
        if (!isValidPrice(data.price)) {
            errors.push({
                field: 'price',
                message: 'Price must be a positive integer in paise',
            });
        }
    }

    // 9. Validate 'imageUrl' if present
    if ('imageUrl' in data && data.imageUrl !== null) {
        if (!isValidImageUrl(data.imageUrl)) {
            errors.push({
                field: 'imageUrl',
                message: 'imageUrl must be a valid relative path (starting with /) or HTTP/HTTPS URL',
            });
        }
    }

    // 10. Validate 'isAvailable' if present (allow true or false)
    if ('isAvailable' in data) {
        if (typeof data.isAvailable !== 'boolean') {
            errors.push({ field: 'isAvailable', message: 'isAvailable must be a boolean value' });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}