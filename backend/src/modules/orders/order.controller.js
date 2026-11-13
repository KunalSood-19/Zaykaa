import defaultOrderService from './order.service.js';

export class OrderController {
  /**
   * @param {import('./order.service.js').OrderService} [service]
   */
  constructor(service = defaultOrderService) {
    this.service = service;
  }

  /**
   * Customer places a new order.
   * POST /api/orders
   */
  createOrder = async (req, res, next) => {
    try {
      const { restaurantId, items, deliveryAddress } = req.body || {};
      const order = await this.service.createOrder({
        customerId: req.user?.id,
        restaurantId,
        items,
        deliveryAddress,
      });
      return res.status(201).json({
        success: true,
        data: order,
        message: 'Order placed successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves all orders belonging to a restaurant, sorted newest first.
   * GET /api/orders/restaurant/:restaurantId
   */
  getRestaurantOrders = async (req, res, next) => {
    try {
      const { restaurantId } = req.params;
      const ownerId = req.user?.id;
      const orders = await this.service.getOrdersForRestaurant(restaurantId, ownerId);
      return res.status(200).json({
        success: true,
        data: orders,
        message: 'Restaurant orders retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves complete details of an individual order.
   * Accessible by customer, fulfilling restaurant, or assigned delivery partner.
   * GET /api/orders/:id
   */
  getOrderById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await this.service.getOrderDetails(id, req.user);
      return res.status(200).json({
        success: true,
        data: order,
        message: 'Order retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Updates preparation status of an order for a restaurant.
   * PATCH /api/orders/:id/status
   */
  updateStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ownerId = req.user?.id;
      const { status } = req.body || {};
      const updatedOrder = await this.service.updateOrderStatus(id, ownerId, status);
      return res.status(200).json({
        success: true,
        data: updatedOrder,
        message: 'Order status updated successfully',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Customer cancels an order before preparation begins (Placed or Accepted).
   * POST /api/orders/:id/cancel
   */
  cancelOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const updatedOrder = await this.service.cancelOrder(id, req.user?.id, reason);
      return res.status(200).json({
        success: true,
        data: updatedOrder,
        message: 'Order cancelled successfully',
      });
    } catch (err) {
      return next(err);
    }
  };
}

const defaultOrderController = new OrderController();
export const createOrder = defaultOrderController.createOrder;
export const getOrderById = defaultOrderController.getOrderById;
export const cancelOrder = defaultOrderController.cancelOrder;
export default defaultOrderController;
