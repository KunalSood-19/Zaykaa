import { restaurantService } from './restaurant.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const listRestaurants = async (req, res, next) => {
  try {
    const { search, cuisine, isVeg, sortBy, page, limit } = req.query;
    const { restaurants, meta } = await restaurantService.listRestaurants({
      search,
      cuisine,
      isVeg,
      sortBy,
      page,
      limit
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: restaurants,
      meta
    });
  } catch (err) {
    next(err);
  }
};

export const getRestaurantById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const restaurant = await restaurantService.getRestaurantById(id);

    return sendSuccess(res, {
      statusCode: 200,
      data: restaurant
    });
  } catch (err) {
    next(err);
  }
};
