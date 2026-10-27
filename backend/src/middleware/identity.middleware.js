import { authenticateToken } from './auth.middleware.js';

/**
 * Re-export authenticateToken as resolveCustomerIdentity for seamless backward compatibility
 */
export const resolveCustomerIdentity = authenticateToken;
