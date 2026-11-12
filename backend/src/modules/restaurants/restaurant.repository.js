import { BaseRepository } from '../../utils/base.repository.js';

class RestaurantRepository extends BaseRepository {
  constructor() {
    super('restaurants.json', 'id');
  }
}

export const restaurantRepository = new RestaurantRepository();
