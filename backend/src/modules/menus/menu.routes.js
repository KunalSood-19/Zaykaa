import { Router } from 'express';
import defaultMenuController from './menu.controller.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.middleware.js';

/**
 * Factory to create menu routes with optional custom controller or auth middleware.
 * Uses mergeParams: true so parent route params (e.g. :id) are accessible.
 *
 * @param {import('./menu.controller.js').MenuController} [controller]
 * @param {{ authenticateToken: Function, authorizeRoles: Function }} [auth]
 * @returns {Router}
 */
export function createMenuRouter(
    controller = defaultMenuController,
    auth = { authenticateToken, authorizeRoles }
) {
    const router = Router({ mergeParams: true });

    // Public menu listing for customer discovery
    router.get('/', controller.list);

    // Single menu item lookup
    router.get('/:itemId', controller.getById);

    // Protected restaurant owner menu operations
    router.post('/', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.create);
    router.put('/:itemId', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.update);
    router.patch('/:itemId/availability', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.toggleAvailability);
    router.delete('/:itemId', auth.authenticateToken, auth.authorizeRoles('restaurant'), controller.delete);

    return router;
}

const defaultMenuRouter = createMenuRouter();
export default defaultMenuRouter;