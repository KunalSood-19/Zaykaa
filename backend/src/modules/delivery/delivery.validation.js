/**
 * Zaykaa Delivery Partner Input Validation
 *
 * Provides reusable validation for delivery partner profile creation,
 * updates, and availability toggles strictly adhering to canonical contracts.
 */

export const ALLOWED_VEHICLE_TYPES = [
  'Motorcycle',
  'Scooter',
  'Bicycle',
  'Electric Vehicle',
];

const PROTECTED_FIELDS = [
  'id',
  'userId',
  'activeOrderId',
  'totalDeliveries',
  'createdAt',
  'updatedAt',
];

const ALLOWED_CREATE_FIELDS = ['vehicleType', 'isAvailable'];
const ALLOWED_UPDATE_FIELDS = ['vehicleType', 'isAvailable'];

/**
 * Validates delivery partner profile creation payload.
 *
 * @param {object} data
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateDeliveryPartnerCreate(data) {
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

  // 4. Validate 'vehicleType' (Required, enum)
  if (!('vehicleType' in data) || data.vehicleType === undefined || data.vehicleType === null) {
    errors.push({ field: 'vehicleType', message: 'Vehicle type is required' });
  } else if (typeof data.vehicleType !== 'string') {
    errors.push({ field: 'vehicleType', message: 'Vehicle type must be a string' });
  } else if (!ALLOWED_VEHICLE_TYPES.includes(data.vehicleType.trim())) {
    errors.push({
      field: 'vehicleType',
      message: `Invalid vehicle type '${data.vehicleType}'. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}`,
    });
  }

  // 5. Validate 'isAvailable' (Optional on create, must be boolean if supplied)
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
 * Validates delivery partner profile update payload.
 *
 * @param {object} data
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateDeliveryPartnerUpdate(data) {
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
  const updatableKeys = Object.keys(data).filter((k) =>
    ALLOWED_UPDATE_FIELDS.includes(k)
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

  // 5. Validate 'vehicleType' if present
  if ('vehicleType' in data) {
    if (typeof data.vehicleType !== 'string') {
      errors.push({ field: 'vehicleType', message: 'Vehicle type must be a string' });
    } else if (!ALLOWED_VEHICLE_TYPES.includes(data.vehicleType.trim())) {
      errors.push({
        field: 'vehicleType',
        message: `Invalid vehicle type '${data.vehicleType}'. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}`,
      });
    }
  }

  // 6. Validate 'isAvailable' if present
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
