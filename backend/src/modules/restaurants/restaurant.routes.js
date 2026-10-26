import { Router } from 'express';
import defaultRestaurantController from './restaurant.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.middleware.js';

/**
 * Factory to create restaurant routes with optional custom controller or auth middleware.
 * @param {import('./restaurant.controller.js').RestaurantController} [controller]
 * @param {{ authenticateToken: Function, authorizeRoles: Function }} [auth]
 * @returns {Router}
 */
export function createRestaurantRouter(
  controller = defaultRestaurantController,
  auth = { authenticateToken, authorizeRoles }
) {
  const router = Router();

  // Public discovery routes
  router.get('/', controller.list);

  // Authenticated restaurant owner's own profile (MUST precede '/:id')
  router.get('/mine', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.getMine);

  // Single restaurant details (public)
  router.get('/:id', controller.getById);

  // Protected restaurant profile management
  router.post('/', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.create);
  router.put('/:id', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.update);
  router.delete('/:id', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.delete);

  return router;
}

const defaultRestaurantRouter = createRestaurantRouter();
export default defaultRestaurantRouter;
