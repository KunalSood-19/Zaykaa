import defaultOrderRepository from './order.repository.js';
import defaultRestaurantRepository from '../restaurants/restaurant.repository.js';
import defaultDeliveryRepository from '../delivery/delivery.repository.js';

export const RESTAURANT_TRANSITIONS = {
  Placed: ['Accepted', 'Rejected'],
  Accepted: ['Preparing'],
  Preparing: ['Ready for Pickup'],
};

export const TERMINAL_STATUSES = ['Delivered', 'Rejected', 'Cancelled'];

export class OrderService {
  /**
   * @param {import('./order.repository.js').OrderRepository} [orderRepository]
   * @param {import('../restaurants/restaurant.repository.js').RestaurantRepository} [restaurantRepository]
   * @param {import('../delivery/delivery.repository.js').DeliveryRepository} [deliveryRepository]
   */
  constructor(
    orderRepository = defaultOrderRepository,
    restaurantRepository = defaultRestaurantRepository,
    deliveryRepository = defaultDeliveryRepository
  ) {
    this.orderRepository = orderRepository;
    this.restaurantRepository = restaurantRepository;
    this.deliveryRepository = deliveryRepository;
  }

  /**
   * Retrieves all orders for a restaurant, sorted descending by createdAt.
   * Enforces that the authenticated user owns the restaurant.
   *
   * @param {string} restaurantId
   * @param {string} ownerId
   * @returns {Promise<Array<object>>}
   */
  async getOrdersForRestaurant(restaurantId, ownerId) {
    if (!restaurantId) {
      const err = new Error('Restaurant ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const restaurant = await this.restaurantRepository.findById(restaurantId);
    if (!restaurant) {
      const err = new Error(`Restaurant with ID '${restaurantId}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (restaurant.ownerId !== ownerId) {
      const err = new Error('Forbidden: You do not own this restaurant');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const orders = await this.orderRepository.findByRestaurantId(restaurantId);

    // Sort descending by createdAt (newest first)
    return orders.sort((a, b) => {
      const timeA = new Date(a.timestamps?.createdAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamps?.createdAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Retrieves complete details of an individual order.
   * Enforces ownership authorization for restaurants, customers, and delivery partners.
   *
   * @param {string} orderId
   * @param {{ id: string, role: string }} user
   * @returns {Promise<object>}
   */
  async getOrderDetails(orderId, user) {
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      const err = new Error(`Order with ID '${orderId}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Authorization verification
    if (user.role === 'restaurant') {
      const restaurant = await this.restaurantRepository.findById(order.restaurantId);
      if (!restaurant || restaurant.ownerId !== user.id) {
        const err = new Error('Forbidden: You are not authorized to view orders from another restaurant');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else if (user.role === 'customer') {
      if (order.customerId !== user.id) {
        const err = new Error('Forbidden: You are not authorized to view this order');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else if (user.role === 'delivery') {
      const partner = await this.deliveryRepository.findByUserId(user.id);
      if (!partner || (order.deliveryPartnerId !== partner.id && order.deliveryPartnerId !== user.id)) {
        const err = new Error('Forbidden: You are not authorized to view this order');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else {
      const err = new Error('Forbidden: You are not authorized to view this order');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    return order;
  }

  /**
   * Updates preparation status of an order for a restaurant.
   * Atomically verifies and executes allowed state machine transitions.
   *
   * @param {string} orderId
   * @param {string} ownerId
   * @param {string} targetStatus
   * @returns {Promise<object>}
   */
  async updateOrderStatus(orderId, ownerId, targetStatus) {
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!targetStatus || typeof targetStatus !== 'string') {
      const err = new Error("Field 'status' is required and must be a string");
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const trimmedStatus = targetStatus.trim();
    const ALLOWED_TARGETS = ['Accepted', 'Preparing', 'Ready for Pickup', 'Rejected'];
    if (!ALLOWED_TARGETS.includes(trimmedStatus)) {
      const err = new Error(
        `Invalid target status '${trimmedStatus}'. Allowed restaurant statuses: ${ALLOWED_TARGETS.join(', ')}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    // 1. Initial existence check
    const initialOrder = await this.orderRepository.findById(orderId);
    if (!initialOrder) {
      const err = new Error(`Order with ID '${orderId}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Ownership verification against restaurant
    const restaurant = await this.restaurantRepository.findById(initialOrder.restaurantId);
    if (!restaurant || restaurant.ownerId !== ownerId) {
      const err = new Error('Forbidden: You do not own the restaurant fulfilling this order');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // 3. Serialized atomic transition execution
    return this.orderRepository.store._serialize(this.orderRepository.collection, async () => {
      const orders = await this.orderRepository.store.readCollection(this.orderRepository.collection);
      const index = orders.findIndex((o) => o.id === orderId);

      if (index === -1) {
        const err = new Error(`Order with ID '${orderId}' not found`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const order = orders[index];
      const currentStatus = order.status;

      // Rule: Terminal invariance
      if (TERMINAL_STATUSES.includes(currentStatus)) {
        const err = new Error(`Cannot transition terminal order with status '${currentStatus}'`);
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      // Rule: Valid progression
      const allowedNext = RESTAURANT_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(trimmedStatus)) {
        const err = new Error(
          `Invalid status transition from '${currentStatus}' to '${trimmedStatus}'`
        );
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      const now = new Date().toISOString();
      const createdAt = order.timestamps?.createdAt || order.createdAt || now;
      const updatedOrder = {
        ...order,
        status: trimmedStatus,
        createdAt,
        updatedAt: now,
        timestamps: {
          createdAt,
          updatedAt: now,
        },
      };

      orders[index] = updatedOrder;
      await this.orderRepository.store._writeAtomic(this.orderRepository.collection, orders);
      return JSON.parse(JSON.stringify(updatedOrder));
    });
  }
}

const defaultOrderService = new OrderService();
export default defaultOrderService;
