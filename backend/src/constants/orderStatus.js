/**
 * Canonical Order Status Lifecycle Constants for Zaykaa Platform
 * Adheres strictly to docs/api-contracts.md Section 6 and docs/architecture.md Section 5
 */

export const ORDER_STATUS = Object.freeze({
  PLACED: 'Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
});

export const ALL_ORDER_STATUSES = Object.freeze(Object.values(ORDER_STATUS));

export const TERMINAL_STATUSES = Object.freeze([
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CANCELLED
]);

/**
 * Statuses from which a customer is permitted to cancel an order.
 * According to contract: Customer cancels strictly before preparation starts (Placed or Accepted).
 */
export const CUSTOMER_CANCELLABLE_STATUSES = Object.freeze([
  ORDER_STATUS.PLACED,
  ORDER_STATUS.ACCEPTED
]);
