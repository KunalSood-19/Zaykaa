/**
 * Zaykaa Shared Platform Theme Manager
 * Supports Light mode, Dark mode, and System preference with instant persistence.
 */

const THEME_STORAGE_KEY = 'zaykaa_theme';

/**
 * Gets currently saved theme preference ('light' | 'dark' | 'system').
 * @returns {'light' | 'dark' | 'system'}
 */
export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
}

/**
 * Gets effective active theme ('light' or 'dark').
 * @returns {'light' | 'dark'}
 */
export function getActiveTheme() {
  const saved = getSavedTheme();
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Applies theme attribute to <html> element without page reloads.
 * @param {'light' | 'dark' | 'system'} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;

  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    // System mode: determine based on media query
    root.setAttribute('data-theme', getActiveTheme());
    root.dataset.themePreference = 'system';
  }

  // Update theme toggle buttons if present in DOM
  updateThemeToggleUI();

  // Dispatch custom event for dynamic components
  window.dispatchEvent(
    new CustomEvent('zaykaa:theme-change', {
      detail: {
        theme,
        active: getActiveTheme(),
      },
    })
  );
}

/**
 * Sets and persists theme preference.
 * @param {'light' | 'dark' | 'system'} theme
 */
export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.error('Failed to save theme preference', err);
  }
  applyTheme(theme);
}

/**
 * Toggles between light and dark modes.
 */
export function toggleTheme() {
  const active = getActiveTheme();
  const next = active === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

/**
 * Updates UI toggle buttons across header and profile views.
 */
function updateThemeToggleUI() {
  const active = getActiveTheme();
  const buttons = document.querySelectorAll('.theme-toggle-btn');
  buttons.forEach((btn) => {
    btn.setAttribute('aria-label', `Switch to ${active === 'dark' ? 'light' : 'dark'} mode`);
    const iconEl = btn.querySelector('.theme-toggle-icon');
    const labelEl = btn.querySelector('.theme-toggle-label');
    if (iconEl) {
      iconEl.textContent = active === 'dark' ? '☀️' : '🌙';
    }
    if (labelEl) {
      labelEl.textContent = active === 'dark' ? 'Light' : 'Dark';
    }
  });
}

/**
 * Initializes theme preference on app bootstrap.
 */
export function initTheme() {
  const saved = getSavedTheme();
  applyTheme(saved);

  // Listen for OS system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (getSavedTheme() === 'system') {
        applyTheme('system');
      }
    });
  }

  // Wire up any theme toggle buttons in DOM
  document.addEventListener('DOMContentLoaded', () => {
    updateThemeToggleUI();
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleTheme());
    });
  });
}

// Auto-run on script execution
if (typeof document !== 'undefined') {
  initTheme();
}
