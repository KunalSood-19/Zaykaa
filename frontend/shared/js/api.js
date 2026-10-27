import { getToken, clearSession } from './auth.js';
import { showToast } from './utils.js';

class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Internal request executor handling JSON serialization, JWT injection,
   * error envelopes, and 401 session expiry.
   *
   * @param {string} endpoint
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      ...(options.headers || {}),
    };

    // Attach Bearer token if present
    const token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Auto-set Content-Type for JSON payloads
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let json = null;
      const text = await response.text();
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { message: text };
        }
      }

      // Check HTTP status
      if (!response.ok) {
        // Handle Session Expiry (401)
        if (response.status === 401) {
          clearSession();
          showToast('Session expired. Please sign in again.', 'error');
          window.dispatchEvent(new CustomEvent('zaykaa:session-expired'));
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

      // Return data payload or raw json
      return json?.data !== undefined ? json.data : json;
    } catch (err) {
      if (!err.status && err.name === 'TypeError') {
        err.message = 'Unable to connect to server. Please check your network connection.';
        err.code = 'NETWORK_ERROR';
      }
      throw err;
    }
  }

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
}

export const api = new ApiClient();
export default api;
