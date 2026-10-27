import defaultDeliveryService from './delivery.service.js';

export class DeliveryController {
  /**
   * @param {import('./delivery.service.js').DeliveryService} [service]
   */
  constructor(service = defaultDeliveryService) {
    this.service = service;
  }

  /**
   * Creates a delivery partner profile for the authenticated user.
   * POST /api/partners or POST /api/partners/profile
   */
  create = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const result = await this.service.createProfile(userId, req.body);
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Delivery partner profile created successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves authenticated delivery partner's profile.
   * GET /api/partners/me or GET /api/partners/profile
   */
  getMe = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const result = await this.service.getProfileByUserId(userId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Delivery partner profile retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves the dashboard overview for the delivery partner.
   * GET /api/partners/dashboard
   */
  getDashboard = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const result = await this.service.getDashboard(userId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Dashboard retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves a partner profile by ID (restricted to authenticated owner).
   * GET /api/partners/:id
   */
  getById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await this.service.getProfileById(id, userId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Delivery partner profile retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Updates allowed fields on the delivery partner profile.
   * PUT /api/partners/profile or PUT /api/partners/:id
   */
  update = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const partnerId = req.params.id || null;
      const result = await this.service.updateProfile(userId, req.body, partnerId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Delivery partner profile updated successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Toggles online/offline availability.
   * PATCH /api/partners/availability
   */
  toggleAvailability = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const result = await this.service.setAvailability(
        userId,
        req.body?.isAvailable
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Availability status updated successfully',
      });
    } catch (err) {
      return next(err);
    }
  };
}

const defaultDeliveryController = new DeliveryController();
export default defaultDeliveryController;
