/**
 * Zaykaa Shared API Client
 * Centralized HTTP helper adhering to docs/api-contracts.md envelopes
 */

class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultCustomerId = 'cust_8829';
  }

  /**
   * Set acting customer ID for CE-1 identification
   */
  setCustomerId(customerId) {
    this.defaultCustomerId = customerId;
  }

  /**
   * Internal generic request handler with envelope parsing & error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const headers = {
      'Accept': 'application/json',
      'x-customer-id': this.defaultCustomerId,
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      let responseData = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        responseData = { success: response.ok, message: text };
      }

      if (!response.ok) {
        const errorMessage = responseData?.error?.message || responseData?.message || `Request failed with status ${response.status}`;
        const errorCode = responseData?.error?.code || 'HTTP_ERROR';
        const errorDetails = responseData?.error?.details || null;

        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = errorCode;
        error.details = errorDetails;
        throw error;
      }

      return responseData;
    } catch (err) {
      if (!err.code) {
        err.code = 'NETWORK_ERROR';
        err.message = err.message || 'Unable to connect to Zaykaa API server. Please check your connection.';
      }
      throw err;
    }
  }

  // --- Restaurant Discovery APIs ---

  /**
   * List restaurants with search, filters, sorting, and pagination
   */
  async getRestaurants({ search, cuisine, isVeg, sortBy, page = 1, limit = 10 } = {}) {
    const query = new URLSearchParams();
    if (search) query.append('search', search.trim());
    if (cuisine && cuisine !== 'All') query.append('cuisine', cuisine.trim());
    if (isVeg !== undefined && isVeg !== null && isVeg !== false) query.append('isVeg', 'true');
    if (sortBy) query.append('sortBy', sortBy);
    if (page) query.append('page', page);
    if (limit) query.append('limit', limit);

    const queryString = query.toString();
    const endpoint = `/restaurants${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Get single restaurant details
   */
  async getRestaurantById(id) {
    if (!id) throw new Error('Restaurant ID is required');
    return this.request(`/restaurants/${encodeURIComponent(id)}`);
  }

  /**
   * Get restaurant menu grouped by categories
   */
  async getRestaurantMenu(id, { category, isVeg, availableOnly = true } = {}) {
    if (!id) throw new Error('Restaurant ID is required');
    const query = new URLSearchParams();
    if (category && category !== 'All') query.append('category', category.trim());
    if (isVeg) query.append('isVeg', 'true');
    if (availableOnly !== undefined) query.append('availableOnly', String(availableOnly));

    const queryString = query.toString();
    const endpoint = `/restaurants/${encodeURIComponent(id)}/menu${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  // --- Customer APIs ---

  async getCustomerProfile() {
    return this.request('/customers/profile');
  }

  async updateCustomerProfile(profileData) {
    return this.request('/customers/profile', {
      method: 'PUT',
      body: profileData
    });
  }

  async getCustomerOrders({ status, page = 1, limit = 10 } = {}) {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (page) query.append('page', page);
    if (limit) query.append('limit', limit);

    const queryString = query.toString();
    return this.request(`/customers/orders${queryString ? `?${queryString}` : ''}`);
  }

  // --- Orders APIs ---

  async createOrder(orderPayload) {
    return this.request('/orders', {
      method: 'POST',
      body: orderPayload
    });
  }

  async getOrderById(id) {
    return this.request(`/orders/${encodeURIComponent(id)}`);
  }

  async cancelOrder(id, reason = '') {
    return this.request(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: { reason }
    });
  }
}

// Export singleton instance for client-side usage
export const api = new ApiClient('/api');
export { ApiClient };
