import defaultMenuService from './menu.service.js';

export class MenuController {
    /**
     * @param {import('./menu.service.js').MenuService} [service]
     */
    constructor(service = defaultMenuService) {
        this.service = service;
    }

    /**
     * Adds a new menu item to a restaurant.
     * POST /api/restaurants/:id/menu
     */
    create = async (req, res, next) => {
        try {
            const restaurantId = req.params.id;
            const ownerId = req.user?.id;
            const result = await this.service.addMenuItem(restaurantId, ownerId, req.body);
            return res.status(201).json({
                success: true,
                data: result,
                message: 'Menu item created successfully',
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * Retrieves all menu items belonging to a restaurant.
     * GET /api/restaurants/:id/menu
     */
    list = async (req, res, next) => {
        try {
            const restaurantId = req.params.id;
            const { availableOnly } = req.query;
            const results = await this.service.getMenuItems(restaurantId, { availableOnly });
            return res.status(200).json({
                success: true,
                data: results,
                message: 'Menu items retrieved successfully',
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * Retrieves a single menu item by ID.
     * GET /api/restaurants/:id/menu/:itemId
     */
    getById = async (req, res, next) => {
        try {
            const { id: restaurantId, itemId } = req.params;
            const result = await this.service.getMenuItemById(restaurantId, itemId);
            return res.status(200).json({
                success: true,
                data: result,
                message: 'Menu item retrieved successfully',
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * Updates an existing menu item.
     * PUT /api/restaurants/:id/menu/:itemId
     */
    update = async (req, res, next) => {
        try {
            const { id: restaurantId, itemId } = req.params;
            const ownerId = req.user?.id;
            const result = await this.service.updateMenuItem(restaurantId, itemId, ownerId, req.body);
            return res.status(200).json({
                success: true,
                data: result,
                message: 'Menu item updated successfully',
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * Toggles availability of a menu item.
     * PATCH /api/restaurants/:id/menu/:itemId/availability
     */
    toggleAvailability = async (req, res, next) => {
        try {
            const { id: restaurantId, itemId } = req.params;
            const ownerId = req.user?.id;
            const result = await this.service.toggleAvailability(
                restaurantId,
                itemId,
                ownerId,
                req.body?.isAvailable
            );
            return res.status(200).json({
                success: true,
                data: result,
                message: 'Menu item availability updated',
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * Deletes a menu item.
     * DELETE /api/restaurants/:id/menu/:itemId
     */
    delete = async (req, res, next) => {
        try {
            const { id: restaurantId, itemId } = req.params;
            const ownerId = req.user?.id;
            await this.service.deleteMenuItem(restaurantId, itemId, ownerId);
            return res.status(200).json({
                success: true,
                message: 'Menu item deleted',
            });
        } catch (err) {
            return next(err);
        }
    };
}

const defaultMenuController = new MenuController();
export default defaultMenuController;