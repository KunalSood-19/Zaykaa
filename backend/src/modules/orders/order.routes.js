import { Router } from 'express';
import defaultOrderController from './order.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.middleware.js';

/**
 * Factory to create order routes with optional custom controller or auth middleware.
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

  // Restaurant role guard
  const restaurantGuard = [
    auth.authenticateToken,
    auth.authorizeRoles('restaurant'),
  ];

  // 1. Restaurant incoming orders (MUST precede /:id to prevent route collision)
  router.get('/restaurant/:restaurantId', ...restaurantGuard, controller.getRestaurantOrders);

  // 2. Restaurant status update (Placed -> Accepted/Rejected, Accepted -> Preparing, Preparing -> Ready for Pickup)
  router.patch('/:id/status', ...restaurantGuard, controller.updateStatus);

  // 3. Shared order details (customer who placed it, restaurant fulfilling it, or assigned delivery partner)
  router.get('/:id', auth.authenticateToken, controller.getOrderById);

  return router;
}

const defaultOrderRouter = createOrderRouter();
export default defaultOrderRouter;
