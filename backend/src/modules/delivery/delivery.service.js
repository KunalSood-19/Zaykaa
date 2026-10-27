import defaultDeliveryRepository from './delivery.repository.js';
import defaultOrderRepository from '../orders/order.repository.js';
import defaultRestaurantRepository from '../restaurants/restaurant.repository.js';
import {
  validateDeliveryPartnerCreate,
  validateDeliveryPartnerUpdate,
} from './delivery.validation.js';

export class DeliveryService {
  /**
   * @param {import('./delivery.repository.js').DeliveryRepository} [deliveryRepository]
   * @param {import('../orders/order.repository.js').OrderRepository} [orderRepository]
   * @param {import('../restaurants/restaurant.repository.js').RestaurantRepository} [restaurantRepository]
   */
  constructor(
    deliveryRepository = defaultDeliveryRepository,
    orderRepository = defaultOrderRepository,
    restaurantRepository = defaultRestaurantRepository
  ) {
    this.deliveryRepository = deliveryRepository;
    this.orderRepository = orderRepository;
    this.restaurantRepository = restaurantRepository;
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
   * Reconciles partner active order status against canonical orders collection.
   * Provides self-healing crash-recovery if a server process terminates between
   * two separate collection writes.
   * @private
   * @param {object} partner
   * @returns {Promise<object>}
   */
  async _reconcilePartnerState(partner) {
    if (!partner) return partner;

    // Case 1: Partner points to an activeOrderId that is missing or already terminal
    if (partner.activeOrderId) {
      const active = await this.orderRepository.findById(partner.activeOrderId);
      if (!active || ['Delivered', 'Cancelled', 'Rejected'].includes(active.status)) {
        const updated = await this.deliveryRepository.update(partner.id, {
          activeOrderId: null,
        });
        return updated || partner;
      }
    } else {
      // Case 2: Partner activeOrderId is null, but an in-flight order is assigned to this partner
      const inFlight = await this.orderRepository.findAll(
        (o) =>
          o.deliveryPartnerId === partner.id &&
          ['Accepted', 'Preparing', 'Ready for Pickup', 'Picked Up', 'Out for Delivery'].includes(o.status)
      );
      if (inFlight.length > 0) {
        const updated = await this.deliveryRepository.update(partner.id, {
          activeOrderId: inFlight[0].id,
          isAvailable: false,
        });
        return updated || partner;
      }
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
    let partner = await this.getProfileByUserId(userId);
    partner = await this._reconcilePartnerState(partner);

    let activeOrder = null;
    if (partner.activeOrderId) {
      activeOrder = await this.getActiveOrder(userId);
    }

    let availableOrders = [];
    if (partner.isAvailable === true && !partner.activeOrderId) {
      availableOrders = await this.getAvailableOrders(userId);
    }

    return {
      partner,
      activeOrder,
      availableOrders,
    };
  }

  /**
   * Retrieves orders eligible for delivery assignment.
   * Exposes restaurant pickup info and delivery address while safeguarding private customer data.
   *
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async getAvailableOrders(userId) {
    let partner = await this.getProfileByUserId(userId);
    partner = await this._reconcilePartnerState(partner);

    // If partner is offline or busy with an active order, available pool is empty
    if (!partner.isAvailable || partner.activeOrderId !== null) {
      return [];
    }

    const ELIGIBLE_STATUSES = ['Accepted', 'Preparing', 'Ready for Pickup'];
    const orders = await this.orderRepository.findAll(
      (o) => o.deliveryPartnerId === null && ELIGIBLE_STATUSES.includes(o.status)
    );

    // Sort descending by createdAt (newest first)
    orders.sort((a, b) => {
      const timeA = new Date(a.timestamps?.createdAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamps?.createdAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Enrich with restaurant pickup info and sanitize customer personal phone
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const restaurant = await this.restaurantRepository.findById(order.restaurantId);
        return {
          id: order.id,
          restaurantId: order.restaurantId,
          restaurantName: order.restaurantName,
          pickupAddress: restaurant?.address || null,
          restaurantPhone: restaurant?.phone || null,
          deliveryAddress: order.deliveryAddress,
          items: order.items,
          pricing: order.pricing,
          status: order.status,
          createdAt: order.timestamps?.createdAt || order.createdAt,
          updatedAt: order.timestamps?.updatedAt || order.updatedAt,
          timestamps: order.timestamps,
        };
      })
    );

    return enriched;
  }

  /**
   * Retrieves complete details of the active order currently assigned to the partner.
   *
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async getActiveOrder(userId) {
    let partner = await this.getProfileByUserId(userId);
    partner = await this._reconcilePartnerState(partner);

    if (!partner.activeOrderId) {
      return null;
    }

    const order = await this.orderRepository.findById(partner.activeOrderId);
    if (!order) {
      return null;
    }

    const restaurant = await this.restaurantRepository.findById(order.restaurantId);
    return {
      ...order,
      pickupAddress: restaurant?.address || null,
      restaurantPhone: restaurant?.phone || null,
    };
  }

  /**
   * Retrieves completed order history for the authenticated delivery partner.
   *
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async getDeliveryHistory(userId) {
    const partner = await this.getProfileByUserId(userId);
    const deliveredOrders = await this.orderRepository.findAll(
      (o) => o.deliveryPartnerId === partner.id && o.status === 'Delivered'
    );

    return deliveredOrders.sort((a, b) => {
      const timeA = new Date(a.timestamps?.updatedAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.timestamps?.updatedAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Atomically claims an eligible order for the authenticated delivery partner.
   * Protected by cross-collection mutex serialization.
   *
   * @param {string} userId
   * @param {string} orderId
   * @returns {Promise<object>}
   */
  async acceptOrder(userId, orderId) {
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const partner = await this.getProfileByUserId(userId);

    // Fast pre-check before serialization
    if (!partner.isAvailable) {
      const err = new Error('Partner is currently offline and cannot accept orders');
      err.statusCode = 400;
      err.code = 'PARTNER_UNAVAILABLE';
      throw err;
    }

    if (partner.activeOrderId !== null) {
      const err = new Error('A partner with an active order cannot claim another order');
      err.statusCode = 400;
      err.code = 'ACTIVE_ORDER_RESTRICTION';
      throw err;
    }

    return this.orderRepository.store._serializeMulti(
      [this.deliveryRepository.collection, this.orderRepository.collection],
      async () => {
        // 1. Re-read delivery partners
        const partners = await this.deliveryRepository.store.readCollection(
          this.deliveryRepository.collection
        );
        const partnerIndex = partners.findIndex((p) => p.userId === userId);
        if (partnerIndex === -1) {
          const err = new Error('Delivery partner profile not found');
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        const currentPartner = partners[partnerIndex];

        if (currentPartner.activeOrderId !== null) {
          const err = new Error('A partner with an active order cannot claim another order');
          err.statusCode = 400;
          err.code = 'ACTIVE_ORDER_RESTRICTION';
          throw err;
        }

        if (!currentPartner.isAvailable) {
          const err = new Error('Partner is currently offline and cannot accept orders');
          err.statusCode = 400;
          err.code = 'PARTNER_UNAVAILABLE';
          throw err;
        }

        // 2. Re-read orders
        const orders = await this.orderRepository.store.readCollection(
          this.orderRepository.collection
        );
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex === -1) {
          const err = new Error(`Order with ID '${orderId}' not found`);
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        const currentOrder = orders[orderIndex];

        // 3. Concurrency check: already claimed?
        if (currentOrder.deliveryPartnerId !== null) {
          const err = new Error('Order is already assigned to a delivery partner');
          err.statusCode = 409;
          err.code = 'CONFLICT';
          throw err;
        }

        // 4. Status eligibility check
        const ELIGIBLE_STATUSES = ['Accepted', 'Preparing', 'Ready for Pickup'];
        if (!ELIGIBLE_STATUSES.includes(currentOrder.status)) {
          const err = new Error(
            `Order with status '${currentOrder.status}' is not eligible for delivery assignment`
          );
          err.statusCode = 400;
          err.code = 'ORDER_NOT_ELIGIBLE';
          throw err;
        }

        const now = new Date().toISOString();

        // 5. Update order (preserves immutable fields)
        const updatedOrder = {
          ...currentOrder,
          deliveryPartnerId: currentPartner.id,
          updatedAt: now,
          timestamps: {
            createdAt: currentOrder.timestamps?.createdAt || currentOrder.createdAt || now,
            updatedAt: now,
          },
        };
        orders[orderIndex] = updatedOrder;

        // 6. Update partner
        const updatedPartner = {
          ...currentPartner,
          activeOrderId: currentOrder.id,
          isAvailable: false,
          updatedAt: now,
        };
        partners[partnerIndex] = updatedPartner;

        // 7. Atomic writes to disk
        await this.orderRepository.store._writeAtomic(
          this.orderRepository.collection,
          orders
        );
        await this.deliveryRepository.store._writeAtomic(
          this.deliveryRepository.collection,
          partners
        );

        return JSON.parse(JSON.stringify(updatedOrder));
      }
    );
  }

  /**
   * Confirms package pickup by the assigned delivery partner once order is Ready for Pickup.
   *
   * @param {string} userId
   * @param {string} orderId
   * @returns {Promise<object>}
   */
  async pickupOrder(userId, orderId) {
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const partner = await this.getProfileByUserId(userId);

    return this.orderRepository.store._serialize(
      this.orderRepository.collection,
      async () => {
        const orders = await this.orderRepository.store.readCollection(
          this.orderRepository.collection
        );
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex === -1) {
          const err = new Error(`Order with ID '${orderId}' not found`);
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        const order = orders[orderIndex];

        // Authorization: must be assigned partner
        if (order.deliveryPartnerId !== partner.id) {
          const err = new Error('Forbidden: You are not the assigned delivery partner for this order');
          err.statusCode = 403;
          err.code = 'FORBIDDEN';
          throw err;
        }

        // Terminal invariance
        if (['Delivered', 'Cancelled', 'Rejected'].includes(order.status)) {
          const err = new Error(`Cannot transition terminal order with status '${order.status}'`);
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }

        // Must be in "Ready for Pickup"
        if (order.status !== 'Ready for Pickup') {
          const err = new Error(
            `Order is not ready for pickup yet (current status: '${order.status}')`
          );
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }

        const now = new Date().toISOString();
        const updatedOrder = {
          ...order,
          status: 'Picked Up',
          updatedAt: now,
          timestamps: {
            createdAt: order.timestamps?.createdAt || order.createdAt || now,
            updatedAt: now,
          },
        };
        orders[orderIndex] = updatedOrder;

        await this.orderRepository.store._writeAtomic(
          this.orderRepository.collection,
          orders
        );

        return JSON.parse(JSON.stringify(updatedOrder));
      }
    );
  }

  /**
   * Marks order Out for Delivery once departure from restaurant premises occurs.
   *
   * @param {string} userId
   * @param {string} orderId
   * @returns {Promise<object>}
   */
  async outForDelivery(userId, orderId) {
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const partner = await this.getProfileByUserId(userId);

    return this.orderRepository.store._serialize(
      this.orderRepository.collection,
      async () => {
        const orders = await this.orderRepository.store.readCollection(
          this.orderRepository.collection
        );
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex === -1) {
          const err = new Error(`Order with ID '${orderId}' not found`);
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        const order = orders[orderIndex];

        // Authorization: must be assigned partner
        if (order.deliveryPartnerId !== partner.id) {
          const err = new Error('Forbidden: You are not the assigned delivery partner for this order');
          err.statusCode = 403;
          err.code = 'FORBIDDEN';
          throw err;
        }

        // Terminal invariance
        if (['Delivered', 'Cancelled', 'Rejected'].includes(order.status)) {
          const err = new Error(`Cannot transition terminal order with status '${order.status}'`);
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }

        // Must be in "Picked Up"
        if (order.status !== 'Picked Up') {
          const err = new Error(
            `Order must be 'Picked Up' before marking Out for Delivery (current status: '${order.status}')`
          );
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }

        const now = new Date().toISOString();
        const updatedOrder = {
          ...order,
          status: 'Out for Delivery',
          updatedAt: now,
          timestamps: {
            createdAt: order.timestamps?.createdAt || order.createdAt || now,
            updatedAt: now,
          },
        };
        orders[orderIndex] = updatedOrder;

        await this.orderRepository.store._writeAtomic(
          this.orderRepository.collection,
          orders
        );

        return JSON.parse(JSON.stringify(updatedOrder));
      }
    );
  }

  /**
   * Confirms final customer handover. Atomically completes order and clears partner active assignment.
   *
   * @param {string} userId
   * @param {string} orderId
   * @returns {Promise<object>}
   */
  async deliverOrder(userId, orderId) {
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const partner = await this.getProfileByUserId(userId);

    return this.orderRepository.store._serializeMulti(
      [this.deliveryRepository.collection, this.orderRepository.collection],
      async () => {
        // 1. Re-read orders
        const orders = await this.orderRepository.store.readCollection(
          this.orderRepository.collection
        );
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex === -1) {
          const err = new Error(`Order with ID '${orderId}' not found`);
          err.statusCode = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        const order = orders[orderIndex];

        // Authorization: must be assigned partner
        if (order.deliveryPartnerId !== partner.id) {
          const err = new Error('Forbidden: You are not the assigned delivery partner for this order');
          err.statusCode = 403;
          err.code = 'FORBIDDEN';
          throw err;
        }

        // Terminal invariance / duplicate completion prevention:
        if (order.status === 'Delivered') {
          const err = new Error('Order is already delivered (terminal state)');
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }
        if (['Cancelled', 'Rejected'].includes(order.status)) {
          const err = new Error(`Cannot transition terminal order with status '${order.status}'`);
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }

        // Must be in "Out for Delivery"
        if (order.status !== 'Out for Delivery') {
          const err = new Error(
            `Order must be 'Out for Delivery' before completing delivery (current status: '${order.status}')`
          );
          err.statusCode = 400;
          err.code = 'INVALID_STATE_TRANSITION';
          throw err;
        }

        // 2. Re-read partners
        const partners = await this.deliveryRepository.store.readCollection(
          this.deliveryRepository.collection
        );
        const partnerIndex = partners.findIndex((p) => p.id === partner.id);

        const now = new Date().toISOString();

        // 3. Update order
        const updatedOrder = {
          ...order,
          status: 'Delivered',
          updatedAt: now,
          timestamps: {
            createdAt: order.timestamps?.createdAt || order.createdAt || now,
            updatedAt: now,
          },
        };
        orders[orderIndex] = updatedOrder;

        // 4. Update partner (clear activeOrderId, increment totalDeliveries, restore availability)
        if (partnerIndex !== -1) {
          const currentPartner = partners[partnerIndex];
          partners[partnerIndex] = {
            ...currentPartner,
            activeOrderId: null,
            totalDeliveries: (currentPartner.totalDeliveries || 0) + 1,
            isAvailable: true,
            updatedAt: now,
          };
        }

        // 5. Atomic writes to both collections
        await this.orderRepository.store._writeAtomic(
          this.orderRepository.collection,
          orders
        );
        await this.deliveryRepository.store._writeAtomic(
          this.deliveryRepository.collection,
          partners
        );

        return JSON.parse(JSON.stringify(updatedOrder));
      }
    );
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
