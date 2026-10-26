import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.config.js';
import defaultAuthRepository from '../modules/auth/auth.repository.js';

/**
 * Creates authentication and authorization middleware instances with optional
 * custom repository dependency (useful for unit testing with isolated stores).
 * @param {import('../modules/auth/auth.repository.js').AuthRepository} [repository]
 */
export function createAuthMiddleware(repository = defaultAuthRepository) {
  /**
   * Middleware to authenticate incoming requests via Bearer JWT token.
   * Loads current user from storage and attaches sanitized user to req.user.
   */
  const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required',
        },
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is missing',
        },
      });
    }

    let decoded;
    try {
      const secret = getJwtSecret();
      decoded = jwt.verify(token, secret);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: isExpired ? 'Authentication token has expired' : 'Invalid authentication token',
        },
      });
    }

    // Load active user from persistence layer rather than trusting token claims alone
    try {
      const user = await repository.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User account no longer exists',
          },
        });
      }

      // Attach sanitized user object (excluding passwordHash)
      // eslint-disable-next-line no-unused-vars
      const { passwordHash, ...safeUser } = user;
      req.user = safeUser;
      return next();
    } catch (dbErr) {
      return next(dbErr);
    }
  };

  /**
   * Role-based authorization middleware generator.
   * Accepts one or more required roles.
   * @param {...(string|string[])} roles - Allowed role(s) (e.g. 'restaurant', or ['restaurant', 'delivery'])
   */
  const authorizeRoles = (...roles) => {
    const allowedRoles = roles.flat().map((r) => r.trim());

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required before authorization',
          },
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied: requires one of the following roles: [${allowedRoles.join(', ')}]`,
          },
        });
      }

      return next();
    };
  };

  return { authenticateToken, authorizeRoles };
}

// Default singleton exports
const defaultAuthMiddleware = createAuthMiddleware();
export const authenticateToken = defaultAuthMiddleware.authenticateToken;
export const authorizeRoles = defaultAuthMiddleware.authorizeRoles;
export default defaultAuthMiddleware;
