import defaultDeliveryRepository from './delivery.repository.js';
import {
  validateDeliveryPartnerCreate,
  validateDeliveryPartnerUpdate,
} from './delivery.validation.js';

export class DeliveryService {
  /**
   * @param {import('./delivery.repository.js').DeliveryRepository} [deliveryRepository]
   */
  constructor(deliveryRepository = defaultDeliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  /**
   * Creates a delivery partner profile for an authenticated user with role 'delivery'.
   *
   * @param {string} userId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createProfile(userId, data) {
    if (!userId) {
      const err = new Error('User ID is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // 1. Validate payload
    const validation = validateDeliveryPartnerCreate(data);
    if (!validation.valid) {
      const err = new Error(validation.errors[0]?.message || 'Validation error');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = validation.errors;
      throw err;
    }

    // 2. Check if user already has a partner profile (fast pre-check)
    const existing = await this.deliveryRepository.findByUserId(userId);
    if (existing) {
      const err = new Error('Delivery partner profile already exists for this user');
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }

    // 3. Concurrency-safe creation inside repository serialization
    return this.deliveryRepository.createPartnerWithUniqueUser({
      userId,
      vehicleType: data.vehicleType,
      isAvailable: data.isAvailable,
    });
  }

  /**
   * Retrieves profile of authenticated delivery partner.
   *
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getProfileByUserId(userId) {
    if (!userId) {
      const err = new Error('User ID is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const partner = await this.deliveryRepository.findByUserId(userId);
    if (!partner) {
      const err = new Error('Delivery partner profile not found for this user');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return partner;
  }

  /**
   * Retrieves a delivery partner by their unique ID.
   *
   * @param {string} id
   * @param {string} [requestingUserId]
   * @returns {Promise<object>}
   */
  async getProfileById(id, requestingUserId = null) {
    if (!id) {
      const err = new Error('Partner ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const partner = await this.deliveryRepository.findById(id);
    if (!partner) {
      const err = new Error(`Delivery partner with ID '${id}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // If requesting user is provided and not owner, prevent viewing if restricted
    if (requestingUserId && partner.userId !== requestingUserId) {
      const err = new Error('Forbidden: You are not authorized to access this partner profile');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    return partner;
  }

  /**
   * Retrieves the dashboard overview for the authenticated delivery partner.
   *
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getDashboard(userId) {
    const partner = await this.getProfileByUserId(userId);
    return {
      partner,
      activeOrder: null, // Order assignment deferred to subsequent tasks
      availableOrders: [],
    };
  }

  /**
   * Updates allowed profile fields.
   *
   * @param {string} userId
   * @param {object} updateData
   * @param {string} [partnerId]
   * @returns {Promise<object>}
   */
  async updateProfile(userId, updateData, partnerId = null) {
    if (!userId) {
      const err = new Error('User ID is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // 1. Validate update payload
    const validation = validateDeliveryPartnerUpdate(updateData);
    if (!validation.valid) {
      const err = new Error(validation.errors[0]?.message || 'Validation error');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = validation.errors;
      throw err;
    }

    // 2. Fetch existing profile
    let partner;
    if (partnerId) {
      partner = await this.deliveryRepository.findById(partnerId);
      if (!partner) {
        const err = new Error(`Delivery partner with ID '${partnerId}' not found`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (partner.userId !== userId) {
        const err = new Error('Forbidden: You are not authorized to update this profile');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else {
      partner = await this.getProfileByUserId(userId);
    }

    // 3. Availability rule: cannot become available if activeOrderId is not null
    if (updateData.isAvailable === true && partner.activeOrderId !== null) {
      const err = new Error('A partner with an active order cannot become available for another order');
      err.statusCode = 400;
      err.code = 'ACTIVE_ORDER_RESTRICTION';
      throw err;
    }

    // 4. Strip protected fields
    // eslint-disable-next-line no-unused-vars
    const {
      id: _id,
      userId: _userId,
      activeOrderId: _activeOrderId,
      totalDeliveries: _totalDeliveries,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...safeUpdates
    } = updateData;

    return this.deliveryRepository.update(partner.id, safeUpdates);
  }

  /**
   * Toggles availability status for the authenticated partner.
   *
   * @param {string} userId
   * @param {boolean} isAvailable
   * @returns {Promise<object>}
   */
  async setAvailability(userId, isAvailable) {
    if (typeof isAvailable !== 'boolean') {
      const err = new Error("Field 'isAvailable' must be a boolean value");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const partner = await this.getProfileByUserId(userId);

    if (isAvailable === true && partner.activeOrderId !== null) {
      const err = new Error('A partner with an active order cannot become available for another order');
      err.statusCode = 400;
      err.code = 'ACTIVE_ORDER_RESTRICTION';
      throw err;
    }

    return this.deliveryRepository.update(partner.id, { isAvailable });
  }
}

const defaultDeliveryService = new DeliveryService();
export default defaultDeliveryService;
