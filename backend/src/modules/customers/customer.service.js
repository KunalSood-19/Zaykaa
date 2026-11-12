import { customerRepository } from './customer.repository.js';
import { ApiError } from '../../utils/apiError.js';

class CustomerService {
  /**
   * Fetch customer profile by ID
   */
  async getProfile(customerId) {
    if (!customerId) {
      throw ApiError.unauthorized('Customer identity is required', 'UNAUTHORIZED');
    }

    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`, 'CUSTOMER_NOT_FOUND');
    }

    return customer;
  }

  /**
   * Update customer profile writable fields (name, phone, addresses)
   */
  async updateProfile(customerId, updates = {}) {
    const existing = await this.getProfile(customerId);

    const safeUpdates = {};

    // Validate name if provided
    if ('name' in updates) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        throw ApiError.badRequest('Name must be a non-empty string', 'VALIDATION_ERROR');
      }
      safeUpdates.name = updates.name.trim();
    }

    // Validate phone if provided
    if ('phone' in updates) {
      if (typeof updates.phone !== 'string' || !updates.phone.trim()) {
        throw ApiError.badRequest('Phone must be a valid non-empty string', 'VALIDATION_ERROR');
      }
      safeUpdates.phone = updates.phone.trim();
    }

    // Validate addresses array if provided
    if ('addresses' in updates) {
      if (!Array.isArray(updates.addresses)) {
        throw ApiError.badRequest('Addresses must be an array', 'VALIDATION_ERROR');
      }

      safeUpdates.addresses = updates.addresses.map((addr, idx) => {
        if (!addr || typeof addr !== 'object') {
          throw ApiError.badRequest(`Address at index ${idx} is invalid`, 'VALIDATION_ERROR');
        }
        if (!addr.street || typeof addr.street !== 'string' || !addr.street.trim()) {
          throw ApiError.badRequest(`Address street is required at index ${idx}`, 'VALIDATION_ERROR');
        }
        if (!addr.city || typeof addr.city !== 'string' || !addr.city.trim()) {
          throw ApiError.badRequest(`Address city is required at index ${idx}`, 'VALIDATION_ERROR');
        }
        if (!addr.pincode || typeof addr.pincode !== 'string' || !addr.pincode.trim()) {
          throw ApiError.badRequest(`Address pincode is required at index ${idx}`, 'VALIDATION_ERROR');
        }

        return {
          id: addr.id || `addr_${Date.now()}_${idx}`,
          label: typeof addr.label === 'string' && addr.label.trim() ? addr.label.trim() : 'Home',
          street: addr.street.trim(),
          city: addr.city.trim(),
          pincode: addr.pincode.trim(),
          isDefault: Boolean(addr.isDefault)
        };
      });
    }

    const updated = await customerRepository.update(customerId, safeUpdates);
    return updated;
  }
}

export const customerService = new CustomerService();
