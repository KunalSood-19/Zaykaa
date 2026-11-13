import { Router } from 'express';
import defaultRestaurantController from './restaurant.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.middleware.js';
import defaultMenuRouter from '../menus/menu.routes.js';

/**
 * Factory to create restaurant routes with optional custom controller
 * and authentication middleware.
 *
 * @param {import('./restaurant.controller.js').RestaurantController} [controller]
 * @param {{ authenticateToken: Function, authorizeRoles: Function }} [auth]
 * @param {Router} [menuRouter]
 * @returns {Router}
 */
export function createRestaurantRouter(
  controller = defaultRestaurantController,
  auth = { authenticateToken, authorizeRoles },
  menuRouter = defaultMenuRouter
) {
  const router = Router();

  // Public restaurant listing with optional search, cuisine, veg, sort, pagination filters
  router.get('/', controller.list);

  // Authenticated restaurant owner's profile (must precede /:id)
  router.get(
    '/mine',
    auth.authenticateToken,
    auth.authorizeRoles('restaurant'),
    controller.getMine
  );

  // Nested menu routes (handles both public customer menu discovery and owner menu CRUD)
  router.use('/:id/menu', menuRouter);

  // Public restaurant details
  router.get('/:id', controller.getById);

  // Protected restaurant owner management routes
  router.post(
    '/',
    auth.authenticateToken,
    auth.authorizeRoles('restaurant'),
    controller.create
  );

  router.put(
    '/:id',
    auth.authenticateToken,
    auth.authorizeRoles('restaurant'),
    controller.update
  );

  router.delete(
    '/:id',
    auth.authenticateToken,
    auth.authorizeRoles('restaurant'),
    controller.delete
  );

  return router;
}

const defaultRestaurantRouter = createRestaurantRouter();
export default defaultRestaurantRouter;
