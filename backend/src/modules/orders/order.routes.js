import { Router } from 'express';
import defaultOrderController from './order.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.middleware.js';

/**
 * Factory to create order routes with optional custom controller or auth middleware.
 * Supports Customer order placement/cancellation, Restaurant queue/status updates,
 * and shared authenticated order details lookup.
 *
 * @param {import('./order.controller.js').OrderController} [controller]
 * @param {{ authenticateToken: Function, authorizeRoles: Function }} [auth]
 * @returns {Router}
 */
export function createOrderRouter(
  controller = defaultOrderController,
  auth = { authenticateToken, authorizeRoles }
) {
  const router = Router();

  const customerGuard = [
    auth.authenticateToken,
    auth.authorizeRoles('customer'),
  ];

  const restaurantGuard = [
    auth.authenticateToken,
    auth.authorizeRoles('restaurant'),
  ];

  // 1. Customer places a new order
  router.post('/', ...customerGuard, controller.createOrder);

  // 2. Restaurant incoming orders (MUST precede /:id to prevent route collision)
  router.get('/restaurant/:restaurantId', ...restaurantGuard, controller.getRestaurantOrders);

  // 3. Restaurant status update (Placed -> Accepted/Rejected, Accepted -> Preparing, Preparing -> Ready for Pickup)
  router.patch('/:id/status', ...restaurantGuard, controller.updateStatus);

  // 4. Customer cancels an order before preparation begins
  router.post('/:id/cancel', ...customerGuard, controller.cancelOrder);

  // 5. Shared order details (customer who placed it, restaurant fulfilling it, or assigned delivery partner)
  router.get('/:id', auth.authenticateToken, controller.getOrderById);

  return router;
}

const defaultOrderRouter = createOrderRouter();
export default defaultOrderRouter;
