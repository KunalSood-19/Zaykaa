import {
  getToken as getAuthToken,
  getUser,
  setSession,
  clearSession,
} from './auth.js';
import { showToast } from './utils.js';

function paiseToRupees(paise) {
  const num = Number(paise);
  if (!Number.isFinite(num)) return 0;
  return Number((num / 100).toFixed(2));
}

function adaptRestaurantForCustomer(r) {
  if (!r || typeof r !== 'object') return r;
  return {
    ...r,
    cuisines: Array.isArray(r.cuisines)
      ? r.cuisines
      : Array.isArray(r.cuisineTypes)
      ? r.cuisineTypes
      : [],
    bannerImage: r.bannerImage || r.imageUrl || '',
    contact: r.contact || (r.phone ? { phone: r.phone } : undefined),
    ...(typeof r.costForTwo === 'number' ? { costForTwo: paiseToRupees(r.costForTwo) } : {}),
    ...(typeof r.deliveryFee === 'number' ? { deliveryFee: paiseToRupees(r.deliveryFee) } : {}),
  };
}

function adaptMenuItemForCustomer(item) {
  if (!item || typeof item !== 'object') return item;
  const canonicalId = item.itemId || item.id;
  return {
    ...item,
    id: item.id || canonicalId,
    itemId: canonicalId,
    price: paiseToRupees(item.price),
  };
}

function adaptOrderForCustomer(order) {
  if (!order || typeof order !== 'object') return order;
  const pricing = order.pricing || {};
  return {
    ...order,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          ...item,
          price: paiseToRupees(item.price),
        }))
      : [],
    pricing: {
      ...pricing,
      subtotal: paiseToRupees(pricing.subtotal),
      deliveryFee: paiseToRupees(pricing.deliveryFee),
      tax: paiseToRupees(pricing.tax),
      total: paiseToRupees(pricing.total),
    },
  };
}

class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  getToken() {
    const token = getAuthToken();
    if (token) return token;
    try {
      return localStorage.getItem('zaykaa_token') || null;
    } catch {
      return null;
    }
  }

  getCurrentUser() {
    return getUser();
  }

  _buildUrl(endpoint) {
    if (endpoint.startsWith('http')) return endpoint;
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (!this.baseUrl) return normalized;
    if (normalized.startsWith(`${this.baseUrl}/`) || normalized === this.baseUrl) {
      return normalized;
    }
    return `${this.baseUrl}${normalized}`;
  }

  /**
   * Internal request executor handling JSON serialization, strict JWT injection,
   * error envelopes, and 401 session expiry.
   *
   * @param {string} endpoint
   * @param {RequestInit & { rawEnvelope?: boolean }} [options={}]
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const { rawEnvelope = false, ...fetchOptions } = options;
    const url = this._buildUrl(endpoint);
    const headers = {
      Accept: 'application/json',
      ...(fetchOptions.headers || {}),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (
      fetchOptions.body &&
      typeof fetchOptions.body === 'object' &&
      !(fetchOptions.body instanceof FormData)
    ) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      let json = null;
      const text = await response.text();
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { success: response.ok, message: text };
        }
      }

      if (!response.ok) {
        const isAuthCredentialAttempt =
          url.includes('/auth/login') || url.includes('/auth/register');

        if (response.status === 401 && token && !isAuthCredentialAttempt) {
          clearSession();
          try {
            localStorage.removeItem('zaykaa_token');
          } catch {
            // ignore storage errors
          }
          if (typeof showToast === 'function') {
            showToast('Session expired. Please sign in again.', 'error');
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('zaykaa:session-expired'));
          }
        }

        const error = new Error(
          json?.error?.message || json?.message || `HTTP error ${response.status}`
        );
        error.status = response.status;
        error.code = json?.error?.code || 'API_ERROR';
        error.details = json?.error?.details || null;
        error.response = json;
        throw error;
      }

      if (rawEnvelope) {
        return json;
      }

      return json?.data !== undefined ? json.data : json;
    } catch (err) {
      if (!err.status && err.name === 'TypeError') {
        err.message = 'Unable to connect to server. Please check your network connection.';
        err.code = 'NETWORK_ERROR';
      }
      throw err;
    }
  }

  // --- Member 2 Generic HTTP Helpers (return unwrapped `data` payload) ---

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // --- Member 1 Customer Portal API Helpers (return full envelope + rupee display adapters) ---

  async getRestaurants({ search, cuisine, isVeg, sortBy, page = 1, limit = 10 } = {}) {
    const query = new URLSearchParams();
    if (search) query.append('search', search.trim());
    if (cuisine && cuisine !== 'All') query.append('cuisine', cuisine.trim());
    if (isVeg !== undefined && isVeg !== null && isVeg !== false) query.append('isVeg', 'true');
    if (sortBy) query.append('sortBy', sortBy);
    if (page) query.append('page', page);
    if (limit) query.append('limit', limit);

    const queryString = query.toString();
    const res = await this.request(`/api/restaurants${queryString ? `?${queryString}` : ''}`, {
      rawEnvelope: true,
    });
    if (res && Array.isArray(res.data)) {
      res.data = res.data.map(adaptRestaurantForCustomer);
    }
    return res;
  }

  async getRestaurantById(id) {
    if (!id) throw new Error('Restaurant ID is required');
    const res = await this.request(`/api/restaurants/${encodeURIComponent(id)}`, {
      rawEnvelope: true,
    });
    if (res && res.data) {
      res.data = adaptRestaurantForCustomer(res.data);
    }
    return res;
  }

  async getRestaurantMenu(id, { category, isVeg, availableOnly = true } = {}) {
    if (!id) throw new Error('Restaurant ID is required');
    const query = new URLSearchParams();
    query.append('grouped', 'true');
    if (category && category !== 'All') query.append('category', category.trim());
    if (isVeg) query.append('isVeg', 'true');
    if (availableOnly !== undefined) query.append('availableOnly', String(availableOnly));

    const res = await this.request(
      `/api/restaurants/${encodeURIComponent(id)}/menu?${query.toString()}`,
      { rawEnvelope: true }
    );

    if (res && res.data) {
      if (Array.isArray(res.data)) {
        // Fallback grouping if array response received
        const categoryMap = new Map();
        for (const item of res.data) {
          const catName = item.category || 'Specialties';
          if (!categoryMap.has(catName)) categoryMap.set(catName, []);
          categoryMap.get(catName).push(adaptMenuItemForCustomer(item));
        }
        res.data = {
          restaurantId: id,
          categories: Array.from(categoryMap.entries()).map(([name, items]) => ({ name, items })),
        };
      } else if (Array.isArray(res.data.categories)) {
        res.data.categories = res.data.categories.map((cat) => ({
          ...cat,
          items: Array.isArray(cat.items) ? cat.items.map(adaptMenuItemForCustomer) : [],
        }));
      }
    }
    return res;
  }

  async getCustomerProfile() {
    return this.request('/api/customers/profile', { rawEnvelope: true });
  }

  async updateCustomerProfile(profileData) {
    return this.request('/api/customers/profile', {
      method: 'PUT',
      body: profileData,
      rawEnvelope: true,
    });
  }

  async getCustomerOrders({ status, page = 1, limit = 10 } = {}) {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (page) query.append('page', page);
    if (limit) query.append('limit', limit);

    const queryString = query.toString();
    const res = await this.request(
      `/api/customers/orders${queryString ? `?${queryString}` : ''}`,
      { rawEnvelope: true }
    );
    if (res && Array.isArray(res.data)) {
      res.data = res.data.map(adaptOrderForCustomer);
    }
    return res;
  }

  async createOrder(orderPayload) {
    const res = await this.request('/api/orders', {
      method: 'POST',
      body: orderPayload,
      rawEnvelope: true,
    });
    if (res && res.data) {
      res.data = adaptOrderForCustomer(res.data);
    }
    return res;
  }

  async getOrderById(id) {
    const res = await this.request(`/api/orders/${encodeURIComponent(id)}`, {
      rawEnvelope: true,
    });
    if (res && res.data) {
      res.data = adaptOrderForCustomer(res.data);
    }
    return res;
  }

  async cancelOrder(id, reason = '') {
    const res = await this.request(`/api/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: { reason },
      rawEnvelope: true,
    });
    if (res && res.data) {
      res.data = adaptOrderForCustomer(res.data);
    }
    return res;
  }

  async register({ name, email, password, phone, role = 'customer' }) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: { name, email, password, phone, role },
      rawEnvelope: true,
    });
    if (res?.data?.token) {
      setSession(res.data.token, res.data.user);
      try {
        localStorage.setItem('zaykaa_token', res.data.token);
      } catch {
        // ignore storage errors
      }
    }
    return res;
  }

  async login({ email, password }) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      rawEnvelope: true,
    });
    if (res?.data?.token) {
      setSession(res.data.token, res.data.user);
      try {
        localStorage.setItem('zaykaa_token', res.data.token);
      } catch {
        // ignore storage errors
      }
    }
    return res;
  }

  async getMe() {
    return this.request('/api/auth/me', { rawEnvelope: true });
  }

  logout() {
    clearSession();
    try {
      localStorage.removeItem('zaykaa_token');
    } catch {
      // ignore storage errors
    }
  }
}

export const api = new ApiClient();
export { ApiClient };
export default api;
