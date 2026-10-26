/**
 * JWT configuration loader.
 * Throws an explicit error if JWT_SECRET is missing to prevent insecure fallbacks.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
  }
  return secret.trim();
}

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
