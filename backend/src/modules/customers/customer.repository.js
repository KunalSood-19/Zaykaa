import { BaseRepository } from '../../utils/base.repository.js';

class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers.json', 'id');
  }

  async findByEmail(email) {
    if (!email) return null;
    const records = await this.findAll();
    return records.find((c) => c.email && c.email.toLowerCase() === email.toLowerCase()) || null;
  }
}

export const customerRepository = new CustomerRepository();
