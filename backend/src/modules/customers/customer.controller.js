import { customerService } from './customer.service.js';
import { orderService } from '../orders/order.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const getProfile = async (req, res, next) => {
  try {
    const customer = await customerService.getProfile(req.user.id);
    return sendSuccess(res, {
      statusCode: 200,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const updated = await customerService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, {
      statusCode: 200,
      data: updated,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const { orders, meta } = await orderService.getOrdersForCustomer(req.user.id, {
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: orders,
      meta
    });
  } catch (err) {
    next(err);
  }
};
