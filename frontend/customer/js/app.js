/**
 * Zaykaa Customer Portal — Main Application Orchestrator
 * Coordinates restaurant discovery, search, filtering, cart, checkout, order history, and live tracking
 */

import { api } from '../../shared/js/api.js';
import { cart } from './cart.js';
import { RestaurantList } from './restaurantList.js';
import { RestaurantModal } from './restaurantModal.js';
import { CartDrawer } from './cartDrawer.js';
import { CheckoutModal } from './checkoutModal.js';
import { OrderConfirmation } from './orderConfirmation.js';
import { OrderHistory } from './orderHistory.js';
import { OrderDetailsModal } from './orderDetailsModal.js';
import { AuthModal } from './authModal.js';

class CustomerApp {
  constructor() {
    this.state = {
      search: '',
      cuisine: 'All',
      isVeg: false,
      sortBy: 'rating',
      page: 1,
      limit: 20
    };

    this.debounceTimer = null;
    this.pendingConflict = null;

    this.initElements();
    this.initComponents();
    this.bindEvents();
    this.handleRouting();
  }

  initElements() {
    // Navigation & View switcher
    this.navBtnRestaurants = document.getElementById('nav-btn-restaurants');
    this.navBtnOrders = document.getElementById('nav-btn-orders');
    this.viewRestaurants = document.getElementById('view-restaurants');
    this.viewOrders = document.getElementById('view-orders');

    // Discovery elements
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.cuisineChips = document.querySelectorAll('.cuisine-chip');
    this.vegToggleBtn = document.getElementById('veg-only-toggle');
    this.sortSelect = document.getElementById('sort-select');
    this.resultCountEl = document.getElementById('result-count');
    this.restaurantGridEl = document.getElementById('restaurant-grid');
    this.modalBackdropEl = document.getElementById('restaurant-modal');
    this.userProfileNameEl = document.getElementById('user-profile-name');

    // Cart & Checkout elements
    this.navCartBtn = document.getElementById('nav-cart-btn');
    this.navCartCountEl = document.getElementById('nav-cart-count');
    this.cartDrawerEl = document.getElementById('cart-drawer');
    this.checkoutModalEl = document.getElementById('checkout-modal');
    this.confirmationModalEl = document.getElementById('order-confirmation-modal');

    // Conflict Dialog elements
    this.conflictModalEl = document.getElementById('cart-conflict-modal');
    this.conflictMessageEl = document.getElementById('cart-conflict-message');
    this.conflictCancelBtn = document.getElementById('conflict-cancel-btn');
    this.conflictConfirmBtn = document.getElementById('conflict-confirm-btn');

    // Order Details & Tracking Modals
    this.orderDetailsModalEl = document.getElementById('order-details-modal');
    this.orderCancelConfirmModalEl = document.getElementById('order-cancel-confirm-modal');
    this.authModalEl = document.getElementById('auth-modal');
  }

  initComponents() {
    // 1. Restaurant List Component
    this.restaurantList = new RestaurantList({
      containerElement: this.restaurantGridEl,
      onSelectRestaurant: (restaurantId) => {
        this.restaurantModal.open(restaurantId);
      }
    });

    // 2. Restaurant Details & Menu Modal
    this.restaurantModal = new RestaurantModal({
      modalBackdropElement: this.modalBackdropEl,
      api,
      cart,
      onCartConflict: (conflict) => {
        this.showConflictDialog(conflict);
      }
    });

    // 3. Cart Drawer Component
    this.cartDrawer = new CartDrawer({
      drawerElement: this.cartDrawerEl,
      cart,
      onProceedToCheckout: () => {
        this.checkoutModal.open();
      }
    });

    // 4. Checkout Modal Component
    this.checkoutModal = new CheckoutModal({
      modalElement: this.checkoutModalEl,
      api,
      cart,
      onOrderSuccess: (createdOrder) => {
        this.orderConfirmation.open(createdOrder);
      }
    });

    // 5. Order Confirmation Component
    this.orderConfirmation = new OrderConfirmation({
      modalElement: this.confirmationModalEl,
      onClose: () => {
        this.showRestaurantsView();
      },
      onTrackOrder: (order) => {
        this.showOrdersView();
        if (order?.id) {
          this.orderDetailsModal.open(order.id);
        }
      }
    });

    // 6. Order History Component
    this.orderHistory = new OrderHistory({
      containerElement: this.viewOrders,
      api,
      onSelectOrder: (orderId) => {
        this.orderDetailsModal.open(orderId);
      },
      onExploreRestaurants: () => {
        this.showRestaurantsView();
      }
    });

    // 7. Order Details & Live Tracking Modal
    this.orderDetailsModal = new OrderDetailsModal({
      modalElement: this.orderDetailsModalEl,
      cancelModalElement: this.orderCancelConfirmModalEl,
      api,
      onOrderCancelled: (orderId) => {
        // Refresh orders list in background
        this.orderHistory.loadOrders();
      }
    });

    // 8. Auth Modal & Session Component (Syllabus Standard)
    if (this.authModalEl) {
      this.authModal = new AuthModal({
        modalElement: this.authModalEl,
        api,
        onAuthChange: (user) => {
          // If viewing orders, refresh orders list with new user's orders
          if (this.orderHistory) {
            this.orderHistory.loadOrders();
          }
        }
      });
    }
  }

  bindEvents() {
    // Top Navigation View Switcher
    if (this.navBtnRestaurants) {
      this.navBtnRestaurants.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'restaurants';
      });
    }

    if (this.navBtnOrders) {
      this.navBtnOrders.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'orders';
      });
    }

    // URL Hash Routing
    window.addEventListener('hashchange', () => {
      this.handleRouting();
    });

    // Cart Button Trigger
    if (this.navCartBtn) {
      this.navCartBtn.addEventListener('click', () => {
        this.cartDrawer.open();
      });
    }

    // Cart Count Badge Updates
    cart.subscribe((cartState) => {
      if (this.navCartCountEl) {
        this.navCartCountEl.textContent = cartState.itemCount;
      }
    });

    // Initial badge count
    if (this.navCartCountEl) {
      this.navCartCountEl.textContent = cart.getItemCount();
    }

    // Conflict Dialog Actions
    if (this.conflictCancelBtn) {
      this.conflictCancelBtn.addEventListener('click', () => {
        this.closeConflictDialog();
        this.pendingConflict = null;
      });
    }

    if (this.conflictConfirmBtn) {
      this.conflictConfirmBtn.addEventListener('click', () => {
        if (this.pendingConflict && typeof this.pendingConflict.onDiscardAndAdd === 'function') {
          this.pendingConflict.onDiscardAndAdd();
        }
        this.closeConflictDialog();
        this.pendingConflict = null;
      });
    }

    // Search input (debounced 300ms)
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      const val = e.target.value;

      if (val.trim()) {
        this.searchClearBtn.classList.add('visible');
      } else {
        this.searchClearBtn.classList.remove('visible');
      }

      this.debounceTimer = setTimeout(() => {
        this.state.search = val;
        this.fetchRestaurants();
      }, 300);
    });

    // Clear search button
    this.searchClearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.state.search = '';
      this.searchClearBtn.classList.remove('visible');
      this.searchInput.focus();
      this.fetchRestaurants();
    });

    // Cuisine filter chips
    this.cuisineChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.cuisineChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        this.state.cuisine = chip.dataset.cuisine;
        this.fetchRestaurants();
      });
    });

    // Vegetarian toggle button
    this.vegToggleBtn.addEventListener('click', () => {
      this.state.isVeg = !this.state.isVeg;
      const isActive = this.state.isVeg;

      this.vegToggleBtn.classList.toggle('active', isActive);
      this.vegToggleBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      this.fetchRestaurants();
    });

    // Sorting dropdown
    this.sortSelect.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.fetchRestaurants();
    });
  }

  handleRouting() {
    const hash = (window.location.hash || '').replace(/^#/, '');

    if (hash === 'orders') {
      this.showOrdersView();
    } else if (hash.startsWith('order-')) {
      const orderId = hash.replace('order-', '');
      this.showOrdersView();
      if (orderId) {
        this.orderDetailsModal.open(orderId);
      }
    } else {
      this.showRestaurantsView();
    }
  }

  showRestaurantsView() {
    if (this.viewRestaurants) this.viewRestaurants.style.display = 'block';
    if (this.viewOrders) this.viewOrders.style.display = 'none';

    if (this.navBtnRestaurants) {
      this.navBtnRestaurants.classList.add('active');
      this.navBtnRestaurants.setAttribute('aria-current', 'page');
    }
    if (this.navBtnOrders) {
      this.navBtnOrders.classList.remove('active');
      this.navBtnOrders.removeAttribute('aria-current');
    }
  }

  showOrdersView() {
    if (this.viewRestaurants) this.viewRestaurants.style.display = 'none';
    if (this.viewOrders) this.viewOrders.style.display = 'block';

    if (this.navBtnOrders) {
      this.navBtnOrders.classList.add('active');
      this.navBtnOrders.setAttribute('aria-current', 'page');
    }
    if (this.navBtnRestaurants) {
      this.navBtnRestaurants.classList.remove('active');
      this.navBtnRestaurants.removeAttribute('aria-current');
    }

    // Load customer orders
    this.orderHistory.loadOrders();
  }

  showConflictDialog(conflict) {
    this.pendingConflict = conflict;
    if (this.conflictMessageEl) {
      this.conflictMessageEl.textContent = 
        `Your cart already contains items from "${conflict.existingRestaurantName || 'another restaurant'}". Would you like to discard them to add items from "${conflict.newRestaurantName || 'this restaurant'}"?`;
    }
    if (this.conflictModalEl) {
      this.conflictModalEl.classList.add('open');
      this.conflictModalEl.setAttribute('aria-hidden', 'false');
    }
  }

  closeConflictDialog() {
    if (this.conflictModalEl) {
      this.conflictModalEl.classList.remove('open');
      this.conflictModalEl.setAttribute('aria-hidden', 'true');
    }
  }

  async init() {
    this.loadCustomerProfile();
    this.fetchRestaurants();
  }

  async loadCustomerProfile() {
    try {
      const response = await api.getCustomerProfile();
      if (response && response.data && response.data.name) {
        if (this.userProfileNameEl) {
          this.userProfileNameEl.textContent = response.data.name;
        }
      }
    } catch (err) {
      console.warn('Could not load customer profile details:', err);
    }
  }

  async fetchRestaurants() {
    this.restaurantList.renderLoading();
    this.updateResultCount(null, true);

    try {
      const queryParams = {
        search: this.state.search,
        cuisine: this.state.cuisine,
        isVeg: this.state.isVeg,
        sortBy: this.state.sortBy,
        page: this.state.page,
        limit: this.state.limit
      };

      const response = await api.getRestaurants(queryParams);
      const restaurants = response.data || [];
      const total = response.meta?.total ?? restaurants.length;

      this.restaurantList.render(restaurants, {
        onResetFilters: () => this.resetFilters()
      });
      this.updateResultCount(total, false);
    } catch (err) {
      console.error('Restaurant fetch error:', err);
      this.restaurantList.renderError(err, () => this.fetchRestaurants());
      this.updateResultCount(0, false);
    }
  }

  resetFilters() {
    this.state.search = '';
    this.state.cuisine = 'All';
    this.state.isVeg = false;
    this.state.sortBy = 'rating';

    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchClearBtn?.classList.remove('visible');
    }
    if (this.cuisineChips) {
      this.cuisineChips.forEach((c) => c.classList.toggle('active', c.dataset.cuisine === 'All'));
    }
    if (this.vegToggleBtn) {
      this.vegToggleBtn.classList.remove('active');
      this.vegToggleBtn.setAttribute('aria-pressed', 'false');
    }
    if (this.sortSelect) {
      this.sortSelect.value = 'rating';
    }

    this.fetchRestaurants();
  }

  updateResultCount(count, isLoading = false) {
    if (!this.resultCountEl) return;

    if (isLoading) {
      this.resultCountEl.textContent = 'Searching restaurants...';
      return;
    }

    if (count === 0) {
      this.resultCountEl.textContent = '0 restaurants found';
    } else if (count === 1) {
      this.resultCountEl.textContent = '1 restaurant available';
    } else {
      this.resultCountEl.textContent = `${count} restaurants available`;
    }
  }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CustomerApp();
  app.init();
});