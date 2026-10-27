import api from '../../shared/js/api.js';
import {
  getToken,
  getUser,
  setSession,
  clearSession,
  isAuthenticated,
  hasRole,
} from '../../shared/js/auth.js';
import { showToast, escapeHtml } from '../../shared/js/utils.js';
import { toggleTheme, bindThemeToggleButtons } from '../../shared/js/theme.js';
import { renderOverviewMetrics } from './overview.js';
import { MenuManager } from './menu.js';
import { OrderManager } from './orders.js';
import { ProfileManager } from './profile.js';

class RestaurantApp {
  constructor() {
    this.currentView = 'overview';
    this.currentRestaurant = null;
    this.ordersList = [];
    this.refreshInterval = null;

    // Sub-module managers
    this.profileManager = new ProfileManager((restaurant) => this.onRestaurantUpdated(restaurant));
    this.menuManager = new MenuManager(() => this.currentRestaurant);
    this.orderManager = new OrderManager(
      () => this.currentRestaurant,
      (orders) => this.onOrdersUpdated(orders)
    );

    this.bindGlobalEvents();
  }

  async init() {
    this.updateUserSnippet();

    // Check authentication
    if (!isAuthenticated() || !hasRole('restaurant')) {
      if (isAuthenticated() && !hasRole('restaurant')) {
        showToast('Your account role is not authorized for the restaurant portal', 'error');
        clearSession();
      }
      this.openAuthModal();
      return;
    }

    this.closeAuthModal();

    // Load restaurant profile
    const restaurant = await this.profileManager.loadProfile();
    if (restaurant) {
      await Promise.all([
        this.menuManager.loadMenu(),
        this.orderManager.loadOrders(false),
      ]);
      this.startPolling();
    } else {
      // If no profile, navigate to profile onboarding
      this.navigateTo('profile');
    }
  }

  bindGlobalEvents() {
    // Navigation items
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const viewId = e.currentTarget.dataset.view;
        this.navigateTo(viewId);

        // Close mobile drawer on item select
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });

    // Mobile drawer toggle
    const mobileBtn = document.getElementById('mobile-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Global refresh button on top header
    const refreshBtn = document.getElementById('btn-header-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
        await this.refreshAllData(true);
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('loading');
      });
    }

    // Top header theme toggle buttons (idempotent binding)
    bindThemeToggleButtons();

    // Auth modal form tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        authTabs.forEach((t) => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const target = e.currentTarget.dataset.authTab;
        const loginForm = document.getElementById('auth-login-form');
        const regForm = document.getElementById('auth-register-form');
        if (target === 'login') {
          if (loginForm) loginForm.style.display = 'block';
          if (regForm) regForm.style.display = 'none';
        } else {
          if (loginForm) loginForm.style.display = 'none';
          if (regForm) regForm.style.display = 'block';
        }
      });
    });

    // Login submit
    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Register submit
    const regForm = document.getElementById('auth-register-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Session expired custom event from api.js
    window.addEventListener('zaykaa:session-expired', () => {
      this.stopPolling();
      this.openAuthModal();
    });
  }

  /**
   * Switches the active page view.
   *
   * @param {string} viewId
   */
  navigateTo(viewId) {
    this.currentView = viewId;

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update active page view
    document.querySelectorAll('.page-view').forEach((page) => {
      if (page.id === `view-${viewId}`) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });

    // Update header title
    const headerTitle = document.getElementById('current-header-title');
    if (headerTitle) {
      const titles = {
        overview: 'Restaurant Overview',
        orders: 'Incoming Orders Queue',
        menu: 'Menu Management',
        profile: 'Restaurant Profile',
      };
      headerTitle.textContent = titles[viewId] || 'Restaurant Dashboard';
    }

    // Trigger view-specific loads if necessary
    if (viewId === 'menu' && this.currentRestaurant) {
      this.menuManager.loadMenu();
    } else if (viewId === 'orders' && this.currentRestaurant) {
      this.orderManager.loadOrders(false);
    }
  }

  /**
   * Callback fired when restaurant profile changes or is loaded.
   *
   * @param {object|null} restaurant
   */
  onRestaurantUpdated(restaurant) {
    this.currentRestaurant = restaurant;

    // Update header restaurant status badge
    const headerBadge = document.getElementById('header-rest-status');
    const headerName = document.getElementById('header-rest-name');

    if (restaurant) {
      if (headerName) headerName.textContent = restaurant.name;
      if (headerBadge) {
        const isOpen = restaurant.isOpen !== false;
        headerBadge.style.display = 'inline-flex';
        headerBadge.className = `status-indicator ${isOpen ? 'open' : 'closed'}`;
        headerBadge.innerHTML = `
          <span class="indicator-dot"></span>
          ${isOpen ? 'Kitchen Open' : 'Kitchen Closed'}
        `;
      }
      renderOverviewMetrics(this.ordersList, restaurant);
    } else {
      if (headerName) headerName.textContent = 'Setup Required';
      if (headerBadge) headerBadge.style.display = 'none';
    }
  }

  /**
   * Callback fired when orders are refreshed.
   *
   * @param {Array<object>} orders
   */
  onOrdersUpdated(orders) {
    this.ordersList = orders;
    renderOverviewMetrics(this.ordersList, this.currentRestaurant);
  }

  /**
   * Refreshes all restaurant data.
   *
   * @param {boolean} [showToastFeedback=false]
   */
  async refreshAllData(showToastFeedback = false) {
    if (!this.currentRestaurant) {
      await this.profileManager.loadProfile();
      return;
    }

    await Promise.all([
      this.profileManager.loadProfile(),
      this.menuManager.loadMenu(),
      this.orderManager.loadOrders(showToastFeedback),
    ]);
  }

  startPolling() {
    this.stopPolling();
    // Poll orders every 15 seconds
    this.refreshInterval = setInterval(() => {
      if (isAuthenticated() && this.currentRestaurant) {
        this.orderManager.loadOrders(false);
      }
    }, 15000);
  }

  stopPolling() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  updateUserSnippet() {
    const user = getUser();
    const nameEl = document.getElementById('snippet-user-name');
    const avatarEl = document.getElementById('snippet-user-avatar');

    if (user && nameEl && avatarEl) {
      nameEl.textContent = user.name;
      const initials = user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      avatarEl.textContent = initials || 'R';
    }
  }

  openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  }

  async handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.elements['login-email'].value.trim();
    const password = form.elements['login-password'].value;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Signing In...`;
    }

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const user = res.user;

      if (user.role !== 'restaurant') {
        showToast('Access restricted: This portal is for restaurant owners only', 'error');
        clearSession();
        return;
      }

      setSession(res.token, user);
      showToast(`Welcome back, ${user.name}!`, 'success');
      this.closeAuthModal();
      this.updateUserSnippet();
      await this.init();
    } catch (err) {
      showToast(err.message || 'Login failed. Please check your credentials.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Portal';
      }
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.elements['reg-name'].value.trim();
    const email = form.elements['reg-email'].value.trim();
    const password = form.elements['reg-password'].value;
    const phone = form.elements['reg-phone'].value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Creating Account...`;
    }

    try {
      const res = await api.post('/api/auth/register', {
        name,
        email,
        password,
        phone,
        role: 'restaurant',
      });

      setSession(res.token, res.user);
      showToast(`Account registered successfully. Welcome, ${name}!`, 'success');
      this.closeAuthModal();
      this.updateUserSnippet();
      await this.init();
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Restaurant Account';
      }
    }
  }

  handleLogout() {
    this.stopPolling();
    clearSession();
    this.currentRestaurant = null;
    this.ordersList = [];
    showToast('You have been signed out', 'info');
    this.updateUserSnippet();
    this.openAuthModal();
  }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new RestaurantApp();
  app.init();
  window.zaykaaApp = app;
});
