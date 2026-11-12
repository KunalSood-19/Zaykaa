/**
 * Standardized API Response Utilities for Zaykaa Platform
 * Adheres strictly to docs/api-contracts.md Section 1
 */

export const sendSuccess = (res, { statusCode = 200, data = null, message = null, meta = null } = {}) => {
  const envelope = {
    success: true
  };

  if (data !== null && data !== undefined) {
    envelope.data = data;
  }

  if (message) {
    envelope.message = message;
  }

  if (meta) {
    envelope.meta = meta;
  }

  return res.status(statusCode).json(envelope);
};

export const sendError = (res, { statusCode = 500, code = 'INTERNAL_SERVER_ERROR', message = 'An error occurred', details = null } = {}) => {
  const envelope = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    envelope.error.details = details;
  }

  return res.status(statusCode).json(envelope);
};
