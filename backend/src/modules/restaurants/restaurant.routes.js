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

    // ==========================================
    // PUBLIC RESTAURANT ROUTES
    // ==========================================

    // GET /api/restaurants
    // List restaurants with optional search and cuisine filters
    router.get('/', controller.list);

    // ==========================================
    // AUTHENTICATED RESTAURANT OWNER ROUTES
    // ==========================================

    // GET /api/restaurants/mine
    // Get the authenticated restaurant owner's profile
    // Must appear before the dynamic /:id route
    router.get(
        '/mine',
        auth.authenticateToken,
        auth.authorizeRoles('restaurant'),
        controller.getMine
    );

    // ==========================================
    // NESTED MENU ROUTES
    // ==========================================

    // /api/restaurants/:id/menu
    // Handles menu listing, creation, updates,
    // availability changes and deletion
    router.use('/:id/menu', menuRouter);

    // ==========================================
    // RESTAURANT DETAILS
    // ==========================================

    // GET /api/restaurants/:id
    // Get a restaurant's public details
    router.get('/:id', controller.getById);

    // ==========================================
    // RESTAURANT MANAGEMENT
    // ==========================================

    // POST /api/restaurants
    // Create a restaurant (restaurant role required)
    router.post(
        '/',
        auth.authenticateToken,
        auth.authorizeRoles('restaurant'),
        controller.create
    );

    // PUT /api/restaurants/:id
    // Update a restaurant (owner authorization in service)
    router.put(
        '/:id',
        auth.authenticateToken,
        auth.authorizeRoles('restaurant'),
        controller.update
    );

    // DELETE /api/restaurants/:id
    // Delete a restaurant (owner authorization in service)
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