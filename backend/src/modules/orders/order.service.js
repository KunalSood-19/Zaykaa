import defaultOrderRepository from './order.repository.js';
import defaultRestaurantRepository from '../restaurants/restaurant.repository.js';
import defaultDeliveryRepository from '../delivery/delivery.repository.js';
import defaultMenuRepository from '../menus/menu.repository.js';
import defaultCustomerRepository from '../customers/customer.repository.js';
import { ORDER_STATUS, CUSTOMER_CANCELLABLE_STATUSES } from '../../constants/orderStatus.js';

export const RESTAURANT_TRANSITIONS = {
  Placed: ['Accepted', 'Rejected'],
  Accepted: ['Preparing'],
  Preparing: ['Ready for Pickup'],
};

export const TERMINAL_STATUSES = ['Delivered', 'Rejected', 'Cancelled'];

// Canonical delivery fee in integer paise (₹40.00 = 4000 paise)
const FLAT_DELIVERY_FEE_PAISE = 4000;

export class OrderService {
  /**
   * @param {import('./order.repository.js').OrderRepository} [orderRepository]
   * @param {import('../restaurants/restaurant.repository.js').RestaurantRepository} [restaurantRepository]
   * @param {import('../delivery/delivery.repository.js').DeliveryRepository} [deliveryRepository]
   * @param {import('../menus/menu.repository.js').MenuRepository} [menuRepository]
   * @param {import('../customers/customer.repository.js').CustomerRepository} [customerRepository]
   */
  constructor(
    orderRepository = defaultOrderRepository,
    restaurantRepository = defaultRestaurantRepository,
    deliveryRepository = defaultDeliveryRepository,
    menuRepository = defaultMenuRepository,
    customerRepository = defaultCustomerRepository
  ) {
    this.orderRepository = orderRepository;
    this.restaurantRepository = restaurantRepository;
    this.deliveryRepository = deliveryRepository;
    this.menuRepository = menuRepository;
    this.customerRepository = customerRepository;
  }

  /**
   * Creates a new customer order with authoritative server-side calculation in integer paise.
   *
   * @param {{ customerId: string, restaurantId: string, items: Array<object>, deliveryAddress: object }} [input]
   * @returns {Promise<object>}
   */
  async createOrder({ customerId, restaurantId, items, deliveryAddress } = {}) {
    if (!customerId) {
      const err = new Error('Customer identity is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // 1. Validate request payload
    if (!restaurantId || typeof restaurantId !== 'string' || !restaurantId.trim()) {
      const err = new Error('A valid restaurantId is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Order must contain at least one item');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object' || Array.isArray(deliveryAddress)) {
      const err = new Error('Delivery address is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const { street, city, pincode } = deliveryAddress;
    if (!street || typeof street !== 'string' || !street.trim()) {
      const err = new Error('Delivery address street is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (!city || typeof city !== 'string' || !city.trim()) {
      const err = new Error('Delivery address city is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (!pincode || typeof pincode !== 'string' || !/^\d{6}$/.test(pincode.trim())) {
      const err = new Error('Delivery address pincode must be a valid 6-digit string');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // 2. Customer profile verification (strict; no default-customer fallback)
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      const err = new Error(`Customer with ID '${customerId}' not found`);
      err.statusCode = 404;
      err.code = 'CUSTOMER_NOT_FOUND';
      throw err;
    }

    // 3. Restaurant verification
    const restaurant = await this.restaurantRepository.findById(restaurantId.trim());
    if (!restaurant) {
      const err = new Error(`Restaurant with ID '${restaurantId}' was not found`);
      err.statusCode = 404;
      err.code = 'RESTAURANT_NOT_FOUND';
      throw err;
    }

    if (!restaurant.isOpen) {
      const err = new Error('Restaurant is currently closed and not accepting orders');
      err.statusCode = 400;
      err.code = 'RESTAURANT_CLOSED';
      throw err;
    }

    // 4. Menu items verification & single-restaurant enforcement (supports both `id` and `itemId`)
    const restaurantMenuItems = await this.menuRepository.findByRestaurantId(restaurant.id);
    const menuMap = new Map();
    for (const m of restaurantMenuItems) {
      if (m.id) menuMap.set(String(m.id), m);
      if (m.itemId) menuMap.set(String(m.itemId), m);
    }

    const canonicalItems = [];
    let subtotal = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        const err = new Error('Invalid item in order items array');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }

      const rawId = item.itemId || item.id;
      if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
        const err = new Error('Each item must have a valid itemId');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
      const requestedItemId = rawId.trim();

      const numQty = Number(item.quantity);
      if (!Number.isInteger(numQty) || numQty < 1 || numQty > 20 || String(item.quantity).includes('.')) {
        const err = new Error(`Item '${requestedItemId}' quantity must be an integer between 1 and 20`);
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }

      const menuItem = menuMap.get(requestedItemId);
      if (!menuItem) {
        const itemAnywhere = await this.menuRepository.findById(requestedItemId);
        if (itemAnywhere) {
          const err = new Error(
            `Item '${requestedItemId}' belongs to a different restaurant. All items must be from '${restaurant.name}'`
          );
          err.statusCode = 400;
          err.code = 'VALIDATION_ERROR';
          throw err;
        }
        const err = new Error(`Menu item with ID '${requestedItemId}' was not found`);
        err.statusCode = 404;
        err.code = 'MENU_ITEM_NOT_FOUND';
        throw err;
      }

      const canonicalItemId = String(menuItem.id || menuItem.itemId);
      if (!menuItem.isAvailable) {
        const err = new Error(`Menu item '${menuItem.name}' (${canonicalItemId}) is currently unavailable`);
        err.statusCode = 409;
        err.code = 'ITEM_UNAVAILABLE';
        throw err;
      }

      // Authoritative pricing in integer paise (ignores any client-submitted price)
      const price = Math.round(Number(menuItem.price));
      if (!Number.isFinite(price) || price <= 0) {
        const err = new Error(`Menu item '${menuItem.name}' has an invalid price configuration`);
        err.statusCode = 500;
        err.code = 'INTERNAL_SERVER_ERROR';
        throw err;
      }
      subtotal += price * numQty;

      const existingLine = canonicalItems.find((i) => i.itemId === canonicalItemId);
      if (existingLine) {
        existingLine.quantity += numQty;
        if (existingLine.quantity > 20) {
          const err = new Error(
            `Total quantity for item '${menuItem.name}' (${canonicalItemId}) cannot exceed 20`
          );
          err.statusCode = 400;
          err.code = 'VALIDATION_ERROR';
          throw err;
        }
      } else {
        canonicalItems.push({
          itemId: canonicalItemId,
          name: menuItem.name,
          quantity: numQty,
          price,
        });
      }
    }

    // 5. Server-side price calculation in integer paise (5% GST + ₹40 flat delivery fee)
    const tax = Math.round(subtotal * 0.05);
    const deliveryFee = FLAT_DELIVERY_FEE_PAISE;
    const total = subtotal + deliveryFee + tax;

    const now = new Date().toISOString();
    const canonicalOrder = {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      deliveryPartnerId: null,
      status: ORDER_STATUS.PLACED,
      items: canonicalItems,
      pricing: {
        subtotal,
        deliveryFee,
        tax,
        total,
      },
      deliveryAddress: {
        street: street.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
      },
      timestamps: {
        createdAt: now,
        updatedAt: now,
      },
    };

    return this.orderRepository.create(canonicalOrder);
  }

  /**
   * Retrieves customer order history with optional status filter and pagination.
   *
   * @param {string} customerId
   * @param {{ status?: string, page?: number|string, limit?: number|string }} [options]
   * @returns {Promise<{ orders: Array<object>, meta: { page: number, limit: number, total: number } }>}
   */
  async getOrdersForCustomer(customerId, { status, page = 1, limit = 10 } = {}) {
    if (!customerId) {
      const err = new Error('Customer identity is required');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    return this.orderRepository.findByCustomerId(customerId, { status, page, limit });
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
    if (!orderId || typeof orderId !== 'string') {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const order = await this.orderRepository.findById(orderId.trim());
    if (!order) {
      const err = new Error(`Order with ID '${orderId}' not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Authorization verification
    if (user?.role === 'restaurant') {
      const restaurant = await this.restaurantRepository.findById(order.restaurantId);
      if (!restaurant || restaurant.ownerId !== user.id) {
        const err = new Error('Forbidden: You are not authorized to view orders from another restaurant');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else if (user?.role === 'customer') {
      if (order.customerId !== user.id) {
        const err = new Error('Forbidden: You are not authorized to view this order');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else if (user?.role === 'delivery') {
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
   * Customer-compatible alias for getOrderDetails.
   */
  async getOrderById(orderId, currentUserId, userRole = 'customer') {
    return this.getOrderDetails(orderId, { id: currentUserId, role: userRole });
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

  /**
   * Customer-initiated order cancellation.
   * Atomically verifies ownership and cancellability (Placed or Accepted only) and
   * releases any claimed delivery partner assignment safely.
   *
   * @param {string} orderId
   * @param {string} currentUserId
   * @param {string} [reason='']
   * @returns {Promise<object>}
   */
  async cancelOrder(orderId, currentUserId, reason = '') {
    if (!orderId || typeof orderId !== 'string') {
      const err = new Error('A valid order ID is required');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const trimmedOrderId = orderId.trim();
    const collections = this.deliveryRepository?.collection
      ? [this.orderRepository.collection, this.deliveryRepository.collection]
      : [this.orderRepository.collection];

    return this.orderRepository.store._serializeMulti(collections, async () => {
      const orders = await this.orderRepository.store.readCollection(this.orderRepository.collection);
      const index = orders.findIndex((o) => o.id === trimmedOrderId);

      if (index === -1) {
        const err = new Error(`Order with ID '${orderId}' was not found`);
        err.statusCode = 404;
        err.code = 'ORDER_NOT_FOUND';
        throw err;
      }

      const order = orders[index];

      // Ownership check
      if (!currentUserId || String(order.customerId) !== String(currentUserId)) {
        const err = new Error('You do not have authorization to cancel this order');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_ORDER_ACCESS';
        throw err;
      }

      // Lifecycle state transition guard
      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
        const err = new Error(
          `Order cannot be cancelled in status '${order.status}'. Cancellation is only allowed before preparation begins.`
        );
        err.statusCode = 400;
        err.code = 'ORDER_CANNOT_BE_CANCELLED';
        throw err;
      }

      const now = new Date().toISOString();
      const createdAt = order.timestamps?.createdAt || order.createdAt || now;
      const updatedOrder = {
        ...order,
        status: ORDER_STATUS.CANCELLED,
        cancellationReason:
          typeof reason === 'string' && reason.trim() ? reason.trim() : 'Cancelled by customer',
        createdAt,
        updatedAt: now,
        timestamps: {
          createdAt,
          updatedAt: now,
        },
      };

      orders[index] = updatedOrder;
      await this.orderRepository.store._writeAtomic(this.orderRepository.collection, orders);

      // Release courier slot if order was already claimed in 'Accepted' state
      if (order.deliveryPartnerId && this.deliveryRepository?.collection) {
        const partners = await this.deliveryRepository.store.readCollection(
          this.deliveryRepository.collection
        );
        const partnerIdx = partners.findIndex(
          (p) => p.id === order.deliveryPartnerId && p.activeOrderId === order.id
        );
        if (partnerIdx !== -1) {
          partners[partnerIdx] = {
            ...partners[partnerIdx],
            activeOrderId: null,
            isAvailable: true,
            updatedAt: now,
          };
          await this.deliveryRepository.store._writeAtomic(
            this.deliveryRepository.collection,
            partners
          );
        }
      }

      return JSON.parse(JSON.stringify(updatedOrder));
    });
  }
}

const defaultOrderService = new OrderService();
export const orderService = defaultOrderService;
export default defaultOrderService;
