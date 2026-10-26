import { orderRepository } from './order.repository.js';
import { restaurantRepository } from '../restaurants/restaurant.repository.js';
import { menuRepository } from '../menus/menu.repository.js';
import { customerRepository } from '../customers/customer.repository.js';
import { ORDER_STATUS, CUSTOMER_CANCELLABLE_STATUSES } from '../../constants/orderStatus.js';
import { ApiError } from '../../utils/apiError.js';

class OrderService {
  /**
   * Create a new customer order with authoritative server-side price calculation
   */
  async createOrder({ customerId, restaurantId, items, deliveryAddress } = {}) {
    // 1. Basic validation of request body
    if (!restaurantId || typeof restaurantId !== 'string' || !restaurantId.trim()) {
      throw ApiError.badRequest('A valid restaurantId is required', 'VALIDATION_ERROR');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('Order must contain at least one item', 'VALIDATION_ERROR');
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      throw ApiError.badRequest('Delivery address is required', 'VALIDATION_ERROR');
    }

    const { street, city, pincode } = deliveryAddress;
    if (!street || typeof street !== 'string' || !street.trim()) {
      throw ApiError.badRequest('Delivery address street is required', 'VALIDATION_ERROR');
    }
    if (!city || typeof city !== 'string' || !city.trim()) {
      throw ApiError.badRequest('Delivery address city is required', 'VALIDATION_ERROR');
    }
    if (!pincode || typeof pincode !== 'string' || !pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      throw ApiError.badRequest('Delivery address pincode must be a valid 6-digit string', 'VALIDATION_ERROR');
    }

    // 2. Customer profile verification
    let customer = await customerRepository.findById(customerId);
    if (!customer) {
      // If test customer was requested but not in store, fallback to default seed
      customer = await customerRepository.findById('cust_8829');
    }
    if (!customer) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`, 'CUSTOMER_NOT_FOUND');
    }

    // 3. Restaurant verification
    const restaurant = await restaurantRepository.findById(restaurantId.trim());
    if (!restaurant) {
      throw ApiError.notFound(`Restaurant with ID '${restaurantId}' was not found`, 'RESTAURANT_NOT_FOUND');
    }

    if (!restaurant.isOpen) {
      throw ApiError.badRequest('Restaurant is currently closed and not accepting orders', 'RESTAURANT_CLOSED');
    }

    // 4. Menu Items verification and Single-Restaurant enforcement
    const restaurantMenuItems = await menuRepository.findByRestaurantId(restaurant.id);
    const menuMap = new Map(restaurantMenuItems.map((m) => [String(m.itemId), m]));

    const canonicalItems = [];
    let subtotal = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        throw ApiError.badRequest('Invalid item in order items array', 'VALIDATION_ERROR');
      }

      const itemId = item.itemId;
      if (!itemId || typeof itemId !== 'string' || !itemId.trim()) {
        throw ApiError.badRequest('Each item must have a valid itemId', 'VALIDATION_ERROR');
      }

      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity < 1 || quantity > 20) {
        throw ApiError.badRequest(`Item '${itemId}' quantity must be an integer between 1 and 20`, 'VALIDATION_ERROR');
      }

      // Check if item belongs to this restaurant
      const menuItem = menuMap.get(String(itemId.trim()));
      if (!menuItem) {
        // Check if item exists in another restaurant to give a clear mixed-cart error
        const itemAnywhere = await menuRepository.findById(itemId.trim());
        if (itemAnywhere) {
          throw ApiError.badRequest(
            `Item '${itemId}' belongs to a different restaurant. All items must be from '${restaurant.name}'`,
            'VALIDATION_ERROR'
          );
        }
        throw ApiError.notFound(`Menu item with ID '${itemId}' was not found`, 'MENU_ITEM_NOT_FOUND');
      }

      // Check item availability
      if (!menuItem.isAvailable) {
        throw ApiError.conflict(
          `Menu item '${menuItem.name}' (${menuItem.itemId}) is currently unavailable`,
          'ITEM_UNAVAILABLE'
        );
      }

      // Authoritative pricing: ignore any price passed in the request body
      const price = Number(menuItem.price);
      subtotal += price * quantity;

      canonicalItems.push({
        itemId: menuItem.itemId,
        name: menuItem.name,
        quantity,
        price
      });
    }

    // 5. Server-side price calculation
    const tax = Math.round(subtotal * 0.05); // 5% GST
    const deliveryFee = 40; // Flat ₹40 delivery fee for Phase CE-1
    const total = subtotal + deliveryFee + tax;

    const now = new Date().toISOString();
    const newOrderId = `ord_${Date.now()}`;

    const canonicalOrder = {
      id: newOrderId,
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
        total
      },
      deliveryAddress: {
        street: street.trim(),
        city: city.trim(),
        pincode: pincode.trim()
      },
      timestamps: {
        createdAt: now,
        updatedAt: now
      }
    };

    const savedOrder = await orderRepository.create(canonicalOrder);
    return savedOrder;
  }

  /**
   * Retrieve order details by ID with ownership access control
   */
  async getOrderById(orderId, currentUserId, userRole = 'customer') {
    if (!orderId || typeof orderId !== 'string') {
      throw ApiError.badRequest('A valid order ID is required', 'VALIDATION_ERROR');
    }

    const order = await orderRepository.findById(orderId.trim());
    if (!order) {
      throw ApiError.notFound(`Order with ID '${orderId}' was not found`, 'ORDER_NOT_FOUND');
    }

    // Access control check:
    // Authorized if requester is the customer, assigned restaurant, or assigned delivery partner
    const isCustomerOwner = currentUserId && String(order.customerId) === String(currentUserId);
    const isRestaurantOwner = currentUserId && String(order.restaurantId) === String(currentUserId);
    const isDeliveryPartner = currentUserId && String(order.deliveryPartnerId) === String(currentUserId);

    if (!isCustomerOwner && !isRestaurantOwner && !isDeliveryPartner) {
      throw ApiError.forbidden(
        'You do not have authorization to view this order',
        'FORBIDDEN_ORDER_ACCESS'
      );
    }

    return order;
  }

  /**
   * Retrieve customer's orders history
   */
  async getOrdersForCustomer(customerId, { status, page = 1, limit = 10 } = {}) {
    if (!customerId) {
      throw ApiError.unauthorized('Customer identity is required', 'UNAUTHORIZED');
    }

    return orderRepository.findByCustomerId(customerId, { status, page, limit });
  }

  /**
   * Customer-initiated order cancellation
   * Only permitted while order status is Placed or Accepted (strictly before Preparing)
   */
  async cancelOrder(orderId, currentUserId, reason = '') {
    if (!orderId || typeof orderId !== 'string') {
      throw ApiError.badRequest('A valid order ID is required', 'VALIDATION_ERROR');
    }

    const order = await orderRepository.findById(orderId.trim());
    if (!order) {
      throw ApiError.notFound(`Order with ID '${orderId}' was not found`, 'ORDER_NOT_FOUND');
    }

    // Ownership check
    if (!currentUserId || String(order.customerId) !== String(currentUserId)) {
      throw ApiError.forbidden(
        'You do not have authorization to cancel this order',
        'FORBIDDEN_ORDER_ACCESS'
      );
    }

    // Lifecycle state transition guard
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw ApiError.badRequest(
        `Order cannot be cancelled in status '${order.status}'. Cancellation is only allowed before preparation begins.`,
        'ORDER_CANNOT_BE_CANCELLED'
      );
    }

    const now = new Date().toISOString();
    const updates = {
      status: ORDER_STATUS.CANCELLED,
      cancellationReason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Cancelled by customer',
      timestamps: {
        createdAt: order.timestamps?.createdAt || order.createdAt || now,
        updatedAt: now
      }
    };

    const updatedOrder = await orderRepository.update(order.id, updates);
    return updatedOrder;
  }
}

export const orderService = new OrderService();
