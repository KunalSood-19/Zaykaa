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

  /**
   * Retrieves orders available for delivery assignment.
   * GET /api/partners/orders/available
   */
  getAvailableOrders = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const orders = await this.service.getAvailableOrders(userId);
      return res.status(200).json({
        success: true,
        data: orders,
        message: 'Available orders retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves the currently active order assigned to the partner.
   * GET /api/partners/orders/active
   */
  getActiveOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const order = await this.service.getActiveOrder(userId);
      return res.status(200).json({
        success: true,
        data: order,
        message: 'Active order retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves delivery history (completed orders) for the partner.
   * GET /api/partners/orders/history
   */
  getDeliveryHistory = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const history = await this.service.getDeliveryHistory(userId);
      return res.status(200).json({
        success: true,
        data: history,
        message: 'Delivery history retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Claims an eligible order for delivery.
   * PATCH /api/partners/orders/:id/accept
   */
  acceptOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const order = await this.service.acceptOrder(userId, id);
      return res.status(200).json({
        success: true,
        data: order,
        message: 'Order delivery assignment accepted successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Confirms package pickup from restaurant.
   * PATCH /api/partners/orders/:id/pickup
   */
  pickupOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const order = await this.service.pickupOrder(userId, id);
      return res.status(200).json({
        success: true,
        data: order,
        message: 'Order picked up successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Marks order out for delivery to customer.
   * PATCH /api/partners/orders/:id/out-for-delivery
   */
  outForDelivery = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const order = await this.service.outForDelivery(userId, id);
      return res.status(200).json({
        success: true,
        data: order,
        message: 'Order is out for delivery',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Confirms order delivered to customer.
   * PATCH /api/partners/orders/:id/deliver
   */
  deliverOrder = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const order = await this.service.deliverOrder(userId, id);
      return res.status(200).json({
        success: true,
        data: order,
        message: 'Order delivered successfully',
      });
    } catch (err) {
      return next(err);
    }
  };
}

const defaultDeliveryController = new DeliveryController();
export default defaultDeliveryController;
