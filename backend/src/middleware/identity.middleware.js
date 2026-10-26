/**
 * Customer Identity & Authentication Middleware for Phase CE-1
 *
 * Adheres to docs/api-contracts.md Section 7:
 * - Checks x-customer-id header
 * - Checks Authorization: Bearer token (future JWT bridge)
 * - Falls back to default verified test customer 'cust_8829' for seamless local dev/testing
 */

export const resolveCustomerIdentity = (req, res, next) => {
  const customerIdHeader = req.headers['x-customer-id'];
  const authHeader = req.headers['authorization'];

  let resolvedId = null;

  if (customerIdHeader && typeof customerIdHeader === 'string' && customerIdHeader.trim()) {
    resolvedId = customerIdHeader.trim();
  } else if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    resolvedId = authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  // Contractual fallback for CE-1 local environment
  if (!resolvedId) {
    resolvedId = 'cust_8829';
  }

  req.user = {
    id: resolvedId,
    role: 'customer'
  };

  next();
};
