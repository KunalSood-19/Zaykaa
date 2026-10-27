import { Router } from 'express';
import defaultDeliveryController from './delivery.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.middleware.js';

/**
 * Factory to create delivery partner routes with optional custom controller or auth middleware.
 *
 * @param {import('./delivery.controller.js').DeliveryController} [controller]
 * @param {{ authenticateToken: Function, authorizeRoles: Function }} [auth]
 * @returns {Router}
 */
export function createDeliveryRouter(
  controller = defaultDeliveryController,
  auth = { authenticateToken, authorizeRoles }
) {
  const router = Router();

  // All delivery partner routes require authenticated role: delivery
  const deliveryGuard = [
    auth.authenticateToken,
    auth.authorizeRoles('delivery'),
  ];

  // 1. Dashboard overview
  router.get('/dashboard', ...deliveryGuard, controller.getDashboard);

  // 2. Profile creation (POST /api/partners and POST /api/partners/profile)
  router.post('/', ...deliveryGuard, controller.create);
  router.post('/profile', ...deliveryGuard, controller.create);

  // 3. Authenticated partner profile retrieval (GET /api/partners/me and /profile)
  router.get('/me', ...deliveryGuard, controller.getMe);
  router.get('/profile', ...deliveryGuard, controller.getMe);

  // 4. Availability toggle (PATCH /api/partners/availability)
  router.patch('/availability', ...deliveryGuard, controller.toggleAvailability);

  // 5. Profile update (PUT /api/partners/profile and PUT /api/partners/me)
  router.put('/profile', ...deliveryGuard, controller.update);
  router.put('/me', ...deliveryGuard, controller.update);

  // 6. Direct resource operations by ID (MUST follow specific named routes)
  router.get('/:id', ...deliveryGuard, controller.getById);
  router.put('/:id', ...deliveryGuard, controller.update);
  router.patch('/:id/availability', ...deliveryGuard, controller.toggleAvailability);

  return router;
}

const defaultDeliveryRouter = createDeliveryRouter();
export default defaultDeliveryRouter;
