/**
 * Zaykaa Restaurant Input Validation
 *
 * Provides reusable validation for restaurant creation and profile updates
 * strictly adhering to canonical data models and API contracts.
 */

const PROTECTED_FIELDS = ['id', 'ownerId', 'createdAt', 'updatedAt'];
const ALLOWED_CREATE_FIELDS = [
    'name',
    'description',
    'cuisineTypes',
    'address',
    'phone',
    'imageUrl',
    'isOpen',
];
const ALLOWED_UPDATE_FIELDS = ALLOWED_CREATE_FIELDS;
const ALLOWED_ADDRESS_FIELDS = ['street', 'city', 'pincode'];

// Indian pincode: 6 digits, first digit non-zero (100000 - 999999)
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Validates a phone number ensuring 10 to 15 digits with optional standard delimiters.
 * Accepts formats such as "+91 80 4123 4567", "+91 98765 43210", "9876543210".
 */
function isValidPhone(phone) {
    if (typeof phone !== 'string') return false;
    const trimmed = phone.trim();
    if (!/^\+?[0-9\s\-()]{10,20}$/.test(trimmed)) return false;
    const digitCount = trimmed.replace(/\D/g, '').length;
    return digitCount >= 10 && digitCount <= 15;
}

/**
 * Validates an image URL or local static asset path.
 * Accepts relative paths (e.g. "/assets/images/...") and HTTP/HTTPS URLs.
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
 * Validates restaurant creation payload.
 * All contractually required fields must be present and valid.
 *
 * @param {object} data
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateRestaurantCreate(data) {
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
        if (!ALLOWED_CREATE_FIELDS.includes(key) && !PROTECTED_FIELDS.includes(key)) {
            errors.push({
                field: key,
                message: `Unknown field '${key}' is not permitted`,
            });
        }
    }

    // 4. Validate 'name' (Required, string, 3–100 characters)
    if (!('name' in data) || data.name === undefined || data.name === null) {
        errors.push({ field: 'name', message: 'Restaurant name is required' });
    } else if (typeof data.name !== 'string') {
        errors.push({ field: 'name', message: 'Restaurant name must be a string' });
    } else if (data.name.trim().length < 3 || data.name.trim().length > 100) {
        errors.push({
            field: 'name',
            message: 'Restaurant name must be between 3 and 100 characters',
        });
    }

    // 5. Validate 'description' (Optional, string, max 300 characters)
    if ('description' in data && data.description !== undefined && data.description !== null) {
        if (typeof data.description !== 'string') {
            errors.push({ field: 'description', message: 'Description must be a string' });
        } else if (data.description.trim().length > 300) {
            errors.push({
                field: 'description',
                message: 'Description cannot exceed 300 characters',
            });
        }
    }

    // 6. Validate 'cuisineTypes' (Required, non-empty array of strings)
    if (!('cuisineTypes' in data) || data.cuisineTypes === undefined || data.cuisineTypes === null) {
        errors.push({
            field: 'cuisineTypes',
            message: 'cuisineTypes is required and must be a non-empty array of strings',
        });
    } else if (!Array.isArray(data.cuisineTypes)) {
        errors.push({
            field: 'cuisineTypes',
            message: 'cuisineTypes must be an array of strings',
        });
    } else if (data.cuisineTypes.length === 0) {
        errors.push({
            field: 'cuisineTypes',
            message: 'cuisineTypes must contain at least one cuisine type',
        });
    } else {
        for (let i = 0; i < data.cuisineTypes.length; i++) {
            const item = data.cuisineTypes[i];
            if (typeof item !== 'string' || item.trim().length === 0) {
                errors.push({
                    field: `cuisineTypes[${i}]`,
                    message: 'Each cuisine type must be a non-empty string',
                });
            } else if (item.trim().length > 50) {
                errors.push({
                    field: `cuisineTypes[${i}]`,
                    message: 'Cuisine type cannot exceed 50 characters',
                });
            }
        }
    }

    // 7. Validate 'address' (Required object: street, city, pincode)
    if (!('address' in data) || data.address === undefined || data.address === null) {
        errors.push({ field: 'address', message: 'Address object is required' });
    } else if (typeof data.address !== 'object' || Array.isArray(data.address)) {
        errors.push({ field: 'address', message: 'Address must be a valid JSON object' });
    } else {
        const addressKeys = Object.keys(data.address);

        // Reject unknown fields in address
        for (const aKey of addressKeys) {
            if (!ALLOWED_ADDRESS_FIELDS.includes(aKey)) {
                errors.push({
                    field: `address.${aKey}`,
                    message: `Unknown field '${aKey}' in address is not permitted`,
                });
            }
        }

        // Street (Required, 3–150 chars)
        if (!('street' in data.address) || data.address.street === undefined || data.address.street === null) {
            errors.push({ field: 'address.street', message: 'Street address is required' });
        } else if (typeof data.address.street !== 'string') {
            errors.push({ field: 'address.street', message: 'Street address must be a string' });
        } else if (data.address.street.trim().length < 3 || data.address.street.trim().length > 150) {
            errors.push({
                field: 'address.street',
                message: 'Street address must be between 3 and 150 characters',
            });
        }

        // City (Required, 2–60 chars)
        if (!('city' in data.address) || data.address.city === undefined || data.address.city === null) {
            errors.push({ field: 'address.city', message: 'City is required' });
        } else if (typeof data.address.city !== 'string') {
            errors.push({ field: 'address.city', message: 'City must be a string' });
        } else if (data.address.city.trim().length < 2 || data.address.city.trim().length > 60) {
            errors.push({
                field: 'address.city',
                message: 'City must be between 2 and 60 characters',
            });
        }

        // Pincode (Required, 6 digits)
        if (!('pincode' in data.address) || data.address.pincode === undefined || data.address.pincode === null) {
            errors.push({ field: 'address.pincode', message: 'Pincode is required' });
        } else if (typeof data.address.pincode !== 'string') {
            errors.push({ field: 'address.pincode', message: 'Pincode must be a 6-digit string' });
        } else if (!PINCODE_REGEX.test(data.address.pincode.trim())) {
            errors.push({
                field: 'address.pincode',
                message: 'Pincode must be a valid 6-digit Indian postal code (e.g. 560038)',
            });
        }
    }

    // 8. Validate 'phone' (Required, 10–15 digits)
    if (!('phone' in data) || data.phone === undefined || data.phone === null) {
        errors.push({ field: 'phone', message: 'Phone number is required' });
    } else if (!isValidPhone(data.phone)) {
        errors.push({
            field: 'phone',
            message: 'Phone number must be a valid 10-15 digit phone number',
        });
    }

    // 9. Validate 'imageUrl' (Optional, string URL or relative path)
    if ('imageUrl' in data && data.imageUrl !== undefined && data.imageUrl !== null) {
        if (!isValidImageUrl(data.imageUrl)) {
            errors.push({
                field: 'imageUrl',
                message: 'imageUrl must be a valid relative path (starting with /) or HTTP/HTTPS URL',
            });
        }
    }

    // 10. Validate 'isOpen' (Optional on create, must be boolean if supplied)
    if ('isOpen' in data && data.isOpen !== undefined && data.isOpen !== null) {
        if (typeof data.isOpen !== 'boolean') {
            errors.push({ field: 'isOpen', message: 'isOpen must be a boolean value' });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates partial restaurant update payload.
 * At least one updatable field must be provided.
 *
 * @param {object} data
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateRestaurantUpdate(data) {
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
        if (!ALLOWED_UPDATE_FIELDS.includes(key) && !PROTECTED_FIELDS.includes(key)) {
            errors.push({
                field: key,
                message: `Unknown field '${key}' is not permitted`,
            });
        }
    }

    // 4. Must provide at least one valid updatable field
    const updatableKeys = Object.keys(data).filter(
        (key) => ALLOWED_UPDATE_FIELDS.includes(key)
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
            errors.push({ field: 'name', message: 'Restaurant name must be a string' });
        } else if (data.name.trim().length < 3 || data.name.trim().length > 100) {
            errors.push({
                field: 'name',
                message: 'Restaurant name must be between 3 and 100 characters',
            });
        }
    }

    // 6. Validate 'description' if present
    if ('description' in data && data.description !== null) {
        if (typeof data.description !== 'string') {
            errors.push({ field: 'description', message: 'Description must be a string' });
        } else if (data.description.trim().length > 300) {
            errors.push({
                field: 'description',
                message: 'Description cannot exceed 300 characters',
            });
        }
    }

    // 7. Validate 'cuisineTypes' if present
    if ('cuisineTypes' in data) {
        if (!Array.isArray(data.cuisineTypes)) {
            errors.push({
                field: 'cuisineTypes',
                message: 'cuisineTypes must be an array of strings',
            });
        } else if (data.cuisineTypes.length === 0) {
            errors.push({
                field: 'cuisineTypes',
                message: 'cuisineTypes cannot be empty when provided',
            });
        } else {
            for (let i = 0; i < data.cuisineTypes.length; i++) {
                const item = data.cuisineTypes[i];
                if (typeof item !== 'string' || item.trim().length === 0) {
                    errors.push({
                        field: `cuisineTypes[${i}]`,
                        message: 'Each cuisine type must be a non-empty string',
                    });
                } else if (item.trim().length > 50) {
                    errors.push({
                        field: `cuisineTypes[${i}]`,
                        message: 'Cuisine type cannot exceed 50 characters',
                    });
                }
            }
        }
    }

    // 8. Validate 'address' if present
    if ('address' in data) {
        if (!data.address || typeof data.address !== 'object' || Array.isArray(data.address)) {
            errors.push({ field: 'address', message: 'Address must be a valid JSON object' });
        } else {
            const addressKeys = Object.keys(data.address);
            if (addressKeys.length === 0) {
                errors.push({
                    field: 'address',
                    message: 'Address object cannot be empty when provided',
                });
            }

            for (const aKey of addressKeys) {
                if (!ALLOWED_ADDRESS_FIELDS.includes(aKey)) {
                    errors.push({
                        field: `address.${aKey}`,
                        message: `Unknown field '${aKey}' in address is not permitted`,
                    });
                }
            }

            if ('street' in data.address) {
                if (typeof data.address.street !== 'string') {
                    errors.push({ field: 'address.street', message: 'Street address must be a string' });
                } else if (data.address.street.trim().length < 3 || data.address.street.trim().length > 150) {
                    errors.push({
                        field: 'address.street',
                        message: 'Street address must be between 3 and 150 characters',
                    });
                }
            }

            if ('city' in data.address) {
                if (typeof data.address.city !== 'string') {
                    errors.push({ field: 'address.city', message: 'City must be a string' });
                } else if (data.address.city.trim().length < 2 || data.address.city.trim().length > 60) {
                    errors.push({
                        field: 'address.city',
                        message: 'City must be between 2 and 60 characters',
                    });
                }
            }

            if ('pincode' in data.address) {
                if (typeof data.address.pincode !== 'string') {
                    errors.push({ field: 'address.pincode', message: 'Pincode must be a 6-digit string' });
                } else if (!PINCODE_REGEX.test(data.address.pincode.trim())) {
                    errors.push({
                        field: 'address.pincode',
                        message: 'Pincode must be a valid 6-digit Indian postal code (e.g. 560038)',
                    });
                }
            }
        }
    }

    // 9. Validate 'phone' if present
    if ('phone' in data) {
        if (!isValidPhone(data.phone)) {
            errors.push({
                field: 'phone',
                message: 'Phone number must be a valid 10-15 digit phone number',
            });
        }
    }

    // 10. Validate 'imageUrl' if present
    if ('imageUrl' in data && data.imageUrl !== null) {
        if (!isValidImageUrl(data.imageUrl)) {
            errors.push({
                field: 'imageUrl',
                message: 'imageUrl must be a valid relative path (starting with /) or HTTP/HTTPS URL',
            });
        }
    }

    // 11. Validate 'isOpen' if present
    if ('isOpen' in data) {
        if (typeof data.isOpen !== 'boolean') {
            errors.push({ field: 'isOpen', message: 'isOpen must be a boolean value' });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}