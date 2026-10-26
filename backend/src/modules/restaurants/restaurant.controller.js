import defaultRestaurantService from './restaurant.service.js';

export class RestaurantController {
  /**
   * @param {import('./restaurant.service.js').RestaurantService} [service]
   */
  constructor(service = defaultRestaurantService) {
    this.service = service;
  }

  /**
   * Creates a new restaurant profile.
   * POST /api/restaurants
   */
  create = async (req, res, next) => {
    try {
      const ownerId = req.user?.id;
      const result = await this.service.createRestaurant(ownerId, req.body);
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Restaurant created successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Lists restaurants with optional discovery filtering (search, cuisine).
   * GET /api/restaurants
   */
  list = async (req, res, next) => {
    try {
      const { search, cuisine } = req.query;
      const results = await this.service.getRestaurants({ search, cuisine });
      return res.status(200).json({
        success: true,
        data: results,
        message: 'Restaurants retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves restaurant details by ID.
   * GET /api/restaurants/:id
   */
  getById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.service.getRestaurantById(id);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Restaurant retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves the authenticated owner's restaurant profile.
   * GET /api/restaurants/mine
   */
  getMine = async (req, res, next) => {
    try {
      const ownerId = req.user?.id;
      const result = await this.service.getMyRestaurant(ownerId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Restaurant profile retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Updates an existing restaurant profile.
   * PUT /api/restaurants/:id
   */
  update = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ownerId = req.user?.id;
      const result = await this.service.updateRestaurant(id, ownerId, req.body);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Restaurant updated successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Deletes a restaurant profile.
   * DELETE /api/restaurants/:id
   */
  delete = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ownerId = req.user?.id;
      await this.service.deleteRestaurant(id, ownerId);
      return res.status(200).json({
        success: true,
        message: 'Restaurant deleted successfully',
      });
    } catch (err) {
      return next(err);
    }
  };
}

const defaultRestaurantController = new RestaurantController();
export default defaultRestaurantController;
