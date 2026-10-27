const TOKEN_KEY = 'zaykaa_auth_token';
const USER_KEY = 'zaykaa_user';

const listeners = new Set();

/**
 * Retrieves the stored JWT authentication token.
 * @returns {string|null}
 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Retrieves the stored authenticated user profile.
 * @returns {object|null}
 */
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Stores authentication token and user profile in local storage.
 * @param {string} token
 * @param {object} user
 */
export function setSession(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    notifyListeners();
  } catch (err) {
    console.error('Failed to save session to localStorage', err);
  }
}

/**
 * Clears stored authentication session.
 */
export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    notifyListeners();
  } catch (err) {
    console.error('Failed to clear session from localStorage', err);
  }
}

/**
 * Checks if a session is currently active.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Checks if authenticated user has a specific platform role.
 * @param {string} role
 * @returns {boolean}
 */
export function hasRole(role) {
  const user = getUser();
  return Boolean(user && user.role === role);
}

/**
 * Registers a listener callback invoked when authentication state changes.
 * @param {Function} callback
 * @returns {Function} unsubscribe function
 */
export function onAuthChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  const user = getUser();
  const token = getToken();
  listeners.forEach((listener) => {
    try {
      listener({ token, user, isAuthenticated: Boolean(token) });
    } catch (err) {
      console.error('Auth listener error', err);
    }
  });
}
