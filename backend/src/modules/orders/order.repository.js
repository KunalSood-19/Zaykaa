import { BaseRepository } from '../../utils/base.repository.js';

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders.json', 'id');
  }

  /**
   * Find orders for a specific customer with optional status filtering and pagination
   */
  async findByCustomerId(customerId, { status, page = 1, limit = 10 } = {}) {
    if (!customerId) {
      return { orders: [], meta: { page: 1, limit: 10, total: 0 } };
    }

    const allOrders = await this.findAll((order) => String(order.customerId) === String(customerId));

    let filtered = allOrders;

    if (status && typeof status === 'string' && status.trim()) {
      const targetStatus = status.trim();
      filtered = filtered.filter((o) => o.status && o.status.toLowerCase() === targetStatus.toLowerCase());
    }

    // Sort newest orders first
    filtered.sort((a, b) => {
      const timeA = new Date(a.timestamps?.createdAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamps?.createdAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const total = filtered.length;
    const startIndex = (parsedPage - 1) * parsedLimit;
    const paginated = filtered.slice(startIndex, startIndex + parsedLimit);

    return {
      orders: paginated,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total
      }
    };
  }

  /**
   * Find incoming orders for a restaurant (for future Member 2 integration)
   */
  async findByRestaurantId(restaurantId) {
    if (!restaurantId) return [];
    return this.findAll((order) => String(order.restaurantId) === String(restaurantId));
  }
}

export const orderRepository = new OrderRepository();
