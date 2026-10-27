import api from '../../shared/js/api.js';
import {
  getToken,
  getUser,
  setSession,
  clearSession,
  isAuthenticated,
} from '../../shared/js/auth.js';
import { showToast, escapeHtml } from '../../shared/js/utils.js';
import { toggleTheme } from '../../shared/js/theme.js';
import { renderOverview, renderRecentDeliveries } from './overview.js';
import { AvailableOrdersManager } from './available.js';
import { ActiveDeliveryManager } from './active.js';
import { HistoryManager } from './history.js';
import { ProfileManager } from './profile.js';

export class DeliveryApp {
  constructor() {
    this.currentView = 'overview';
    this.currentPartner = null;
    this.dashboardData = null;
    this.pollingTimer = null;
    this.isFetching = false;

    // Sub-module managers
    this.profileManager = new ProfileManager((partner) => this.onPartnerLoaded(partner));
    this.availableManager = new AvailableOrdersManager(
      () => this.currentPartner,
      (claimedOrder) => this.onOrderClaimed(claimedOrder),
      (viewId) => this.switchView(viewId)
    );
    this.activeManager = new ActiveDeliveryManager(
      () => this.currentPartner,
      (completedOrder) => this.onDeliveryCompleted(completedOrder),
      (viewId) => this.switchView(viewId)
    );
    this.historyManager = new HistoryManager(() => this.currentPartner);

    this.bindGlobalEvents();
  }

  /**
   * Initializes the application.
   */
  async init() {
    if (!isAuthenticated()) {
      this.openAuthModal();
      return;
    }

    const user = getUser();
    if (!user || user.role !== 'delivery') {
      showToast('Access restricted: This portal is for delivery couriers only', 'error');
      this.handleLogout();
      return;
    }

    this.updateUserSnippet(user);

    // Load partner profile and dashboard data
    const partner = await this.profileManager.loadProfile();
    if (partner) {
      await this.refreshAllData();
      this.startPolling();
    }
  }

  bindGlobalEvents() {
    // Navigation items (Sidebar + Mobile Bottom Nav)
    const navButtons = document.querySelectorAll('.delivery-nav-btn, .mobile-nav-item');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        if (view) {
          this.switchView(view);
          // Close mobile sidebar if open
          document.getElementById('delivery-sidebar')?.classList.remove('mobile-open');
        }
      });
    });

    // Mobile Hamburger Menu Toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', () => {
        document.getElementById('delivery-sidebar')?.classList.toggle('mobile-open');
      });
    }

    // Top Header Duty Toggle Click
    const dutyToggle = document.getElementById('duty-toggle');
    if (dutyToggle) {
      dutyToggle.addEventListener('click', () => {
        if (!this.currentPartner) return;
        const next = !this.currentPartner.isAvailable;
        this.profileManager.toggleAvailability(next);
      });
    }

    // Header Refresh button
    const btnRefresh = document.getElementById('btn-header-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.refreshAllData(true);
      });
    }

    // Top Header Theme Toggle button
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        toggleTheme();
      });
    }

    // Sidebar Sign Out button
    const btnLogout = document.getElementById('btn-sidebar-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }

    // Overview "View All" history button
    document.getElementById('btn-view-all-history')?.addEventListener('click', () => {
      this.switchView('history');
    });

    // Auth modal tabs
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('delivery-login-form');
    const formRegister = document.getElementById('delivery-register-form');

    if (tabLogin && tabRegister && formLogin && formRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.style.display = 'block';
        formLogin.style.display = 'none';
      });

      formLogin.addEventListener('submit', (e) => this.handleLogin(e));
      formRegister.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Session Expired Event
    window.addEventListener('zaykaa:session-expired', () => {
      this.handleLogout();
    });
  }

  /**
   * Switches the active view across sidebar, mobile nav, and content panels.
   *
   * @param {string} viewId
   */
  switchView(viewId) {
    this.currentView = viewId;

    // Update active view class
    document.querySelectorAll('.delivery-page-view').forEach((view) => {
      view.classList.toggle('active', view.id === `view-${viewId}`);
    });

    // Update sidebar navigation active state
    document.querySelectorAll('.delivery-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // Update mobile bottom nav active state
    document.querySelectorAll('.mobile-nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Update header title
    const headerTitle = document.getElementById('page-header-title');
    if (headerTitle) {
      const titles = {
        overview: 'Delivery Console',
        available: 'Available Orders',
        active: 'Active Delivery',
        history: 'Delivery History',
        profile: 'Partner Profile',
      };
      headerTitle.textContent = titles[viewId] || 'Delivery Console';
    }

    // View-specific data refreshes
    if (viewId === 'available') {
      this.availableManager.loadAvailableOrders();
    } else if (viewId === 'active') {
      this.activeManager.loadActiveOrder();
    } else if (viewId === 'history') {
      this.historyManager.loadHistory();
    } else if (viewId === 'overview') {
      this.refreshOverview();
    }
  }

  /**
   * Callback fired when partner profile is loaded or updated.
   *
   * @param {object|null} partner
   */
  onPartnerLoaded(partner) {
    this.currentPartner = partner;
    this.updateHeaderDutyState();

    if (!partner) {
      this.switchView('profile');
      return;
    }

    const user = getUser();
    this.updateUserSnippet(user);
    this.refreshOverview();
  }

  /**
   * Updates top header duty toggle visuals.
   */
  updateHeaderDutyState() {
    const toggleEl = document.getElementById('duty-toggle');
    const labelEl = document.getElementById('duty-status-label');
    if (!toggleEl || !labelEl) return;

    if (!this.currentPartner) {
      toggleEl.className = 'duty-toggle-wrapper offline';
      labelEl.textContent = 'Setup Required';
      return;
    }

    const isOnline = this.currentPartner.isAvailable === true;
    toggleEl.className = `duty-toggle-wrapper ${isOnline ? 'online' : 'offline'}`;
    labelEl.textContent = isOnline ? 'Online' : 'Offline';
  }

  /**
   * Callback fired when a delivery order is claimed from the pool.
   *
   * @param {object} claimedOrder
   */
  async onOrderClaimed(claimedOrder) {
    if (this.currentPartner) {
      this.currentPartner.activeOrderId = claimedOrder.id;
      this.currentPartner.isAvailable = false;
      this.updateHeaderDutyState();
    }
    this.switchView('active');
    await this.activeManager.loadActiveOrder();
  }

  /**
   * Callback fired when an active order is delivered to customer.
   *
   * @param {object} completedOrder
   */
  async onDeliveryCompleted() {
    await this.profileManager.loadProfile();
    await this.historyManager.loadHistory();
    this.switchView('overview');
    await this.refreshAllData(false);
  }

  /**
   * Refreshes all core datasets from the backend.
   *
   * @param {boolean} [showToastFeedback=false]
   */
  async refreshAllData(showToastFeedback = false) {
    if (this.isFetching) return;
    this.isFetching = true;

    try {
      const [dashboard, activeOrder, availableOrders, history] = await Promise.all([
        api.get('/api/partners/dashboard'),
        api.get('/api/partners/orders/active').catch(() => null),
        api.get('/api/partners/orders/available').catch(() => []),
        api.get('/api/partners/orders/history').catch(() => []),
      ]);

      this.dashboardData = dashboard;
      if (dashboard.partner) {
        this.currentPartner = dashboard.partner;
        this.updateHeaderDutyState();
      }

      this.availableManager.orders = Array.isArray(availableOrders) ? availableOrders : [];
      this.activeManager.activeOrder = activeOrder || null;
      this.historyManager.history = Array.isArray(history) ? history : [];

      // Update counters
      const badgeEl = document.getElementById('nav-available-count');
      const mobileBadgeEl = document.getElementById('mobile-available-badge');
      const count = this.availableManager.orders.length;
      if (badgeEl) {
        badgeEl.textContent = String(count);
        badgeEl.style.display = count > 0 ? 'inline-block' : 'none';
      }
      if (mobileBadgeEl) {
        mobileBadgeEl.textContent = String(count);
        mobileBadgeEl.style.display = count > 0 ? 'inline-block' : 'none';
      }

      const dot = document.getElementById('nav-active-dot');
      if (dot) {
        dot.style.display = activeOrder ? 'inline-block' : 'none';
      }

      // Re-render current view
      if (this.currentView === 'overview') {
        this.refreshOverview();
      } else if (this.currentView === 'available') {
        this.availableManager.render();
      } else if (this.currentView === 'active') {
        this.activeManager.render();
      } else if (this.currentView === 'history') {
        this.historyManager.render();
      }

      if (showToastFeedback) {
        showToast('Dashboard refreshed with latest orders', 'info');
      }
    } catch (err) {
      if (showToastFeedback) {
        showToast(err.message || 'Failed to refresh dashboard', 'error');
      }
    } finally {
      this.isFetching = false;
    }
  }

  refreshOverview() {
    const user = getUser() || {};
    const data = {
      partner: this.currentPartner,
      activeOrder: this.activeManager.activeOrder,
      availableOrders: this.availableManager.orders,
    };
    renderOverview(data, user, (view) => this.switchView(view));
    renderRecentDeliveries(this.historyManager.history, (view) => this.switchView(view));
  }

  /**
   * Starts periodic polling (every 15 seconds) to discover incoming orders.
   */
  startPolling() {
    this.stopPolling();
    this.pollingTimer = setInterval(() => {
      if (isAuthenticated() && this.currentPartner) {
        this.refreshAllData(false);
      }
    }, 15000);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  updateUserSnippet(user) {
    if (!user) return;
    const nameEl = document.getElementById('snippet-partner-name');
    const avatarEl = document.getElementById('snippet-partner-avatar');
    const vehicleEl = document.getElementById('snippet-partner-vehicle');

    if (nameEl) nameEl.textContent = user.name || 'Courier';
    if (avatarEl) avatarEl.textContent = (user.name || 'D').charAt(0).toUpperCase();
    if (vehicleEl) vehicleEl.textContent = this.currentPartner?.vehicleType || 'Fleet Rider';
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

      if (user.role !== 'delivery') {
        showToast('Access restricted: This portal is for delivery couriers only', 'error');
        clearSession();
        return;
      }

      setSession(res.token, user);
      showToast(`Welcome back, ${user.name}!`, 'success');
      this.closeAuthModal();
      this.updateUserSnippet(user);
      await this.init();
    } catch (err) {
      showToast(err.message || 'Login failed. Please check your credentials.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Fleet';
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
        role: 'delivery',
      });

      setSession(res.token, res.user);
      showToast(`Account registered successfully. Welcome, ${name}!`, 'success');
      this.closeAuthModal();
      this.updateUserSnippet(res.user);
      await this.init();
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Delivery Account';
      }
    }
  }

  handleLogout() {
    this.stopPolling();
    clearSession();
    this.currentPartner = null;
    this.dashboardData = null;
    showToast('Signed out of fleet console', 'info');
    this.openAuthModal();
  }
}

// Start application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new DeliveryApp();
  app.init();
  window.zaykaaDeliveryApp = app;
});
