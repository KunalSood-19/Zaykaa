import { menuService } from './menu.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const getRestaurantMenu = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, isVeg, availableOnly } = req.query;

    const data = await menuService.getMenuByRestaurantId(id, {
      category,
      isVeg,
      availableOnly
    });

    return sendSuccess(res, {
      statusCode: 200,
      data
    });
  } catch (err) {
    next(err);
  }
};
