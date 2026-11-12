import { orderService } from './order.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createOrder = async (req, res, next) => {
  try {
    const { restaurantId, items, deliveryAddress } = req.body;
    const order = await orderService.createOrder({
      customerId: req.user.id,
      restaurantId,
      items,
      deliveryAddress
    });

    return sendSuccess(res, {
      statusCode: 201,
      data: order,
      message: 'Order placed successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id, req.user.id, req.user.role);

    return sendSuccess(res, {
      statusCode: 200,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const updatedOrder = await orderService.cancelOrder(id, req.user.id, reason);

    return sendSuccess(res, {
      statusCode: 200,
      data: updatedOrder,
      message: 'Order cancelled successfully'
    });
  } catch (err) {
    next(err);
  }
};
