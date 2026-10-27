/**
 * Zaykaa Customer Portal — Main Application
 * Coordinates restaurant discovery, search, filtering, cart, checkout, and order creation
 */

import { api } from '../../shared/js/api.js';
import { cart } from './cart.js';
import { RestaurantList } from './restaurantList.js';
import { RestaurantModal } from './restaurantModal.js';
import { CartDrawer } from './cartDrawer.js';
import { CheckoutModal } from './checkoutModal.js';
import { OrderConfirmation } from './orderConfirmation.js';

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
  }

  initElements() {
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
        // Reset view to fresh restaurant list
        this.resetAllFilters();
      }
    });
  }

  bindEvents() {
    // 1. Search input with 300ms debounce
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        this.state.search = val;

        if (this.searchClearBtn) {
          if (val) {
            this.searchClearBtn.classList.add('active');
          } else {
            this.searchClearBtn.classList.remove('active');
          }
        }

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.state.page = 1;
          this.fetchAndRenderRestaurants();
        }, 300);
      });
    }

    // 2. Clear search button
    if (this.searchClearBtn) {
      this.searchClearBtn.addEventListener('click', () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchInput.focus();
        }
        this.state.search = '';
        this.searchClearBtn.classList.remove('active');
        this.state.page = 1;
        this.fetchAndRenderRestaurants();
      });
    }

    // 3. Cuisine chips
    this.cuisineChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.cuisineChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        this.state.cuisine = chip.getAttribute('data-cuisine') || 'All';
        this.state.page = 1;
        this.fetchAndRenderRestaurants();
      });
    });

    // 4. Veg Only toggle
    if (this.vegToggleBtn) {
      this.vegToggleBtn.addEventListener('click', () => {
        this.state.isVeg = !this.state.isVeg;
        this.vegToggleBtn.classList.toggle('active', this.state.isVeg);
        this.vegToggleBtn.setAttribute('aria-pressed', String(this.state.isVeg));
        this.state.page = 1;
        this.fetchAndRenderRestaurants();
      });
    }

    // 5. Sort by select
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.state.page = 1;
        this.fetchAndRenderRestaurants();
      });
    }

    // 6. Nav Cart button
    if (this.navCartBtn) {
      this.navCartBtn.addEventListener('click', () => {
        this.cartDrawer.open();
      });
    }

    // 7. Custom re-open cart event from checkout
    window.addEventListener('zaykaa:open-cart', () => {
      this.cartDrawer.open();
    });

    // 8. Subscribe to cart count for badge updates
    cart.subscribe((cartState) => {
      const count = cart.getItemCount();
      if (this.navCartCountEl) {
        this.navCartCountEl.textContent = count;
      }
    });

    // 9. Conflict dialog listeners
    if (this.conflictCancelBtn) {
      this.conflictCancelBtn.addEventListener('click', () => {
        this.hideConflictDialog();
      });
    }

    if (this.conflictConfirmBtn) {
      this.conflictConfirmBtn.addEventListener('click', () => {
        if (this.pendingConflict) {
          cart.clearAndAdd(this.pendingConflict.item, this.pendingConflict.restaurant);
        }
        this.hideConflictDialog();
      });
    }

    if (this.conflictModalEl) {
      this.conflictModalEl.addEventListener('click', (e) => {
        if (e.target === this.conflictModalEl) {
          this.hideConflictDialog();
        }
      });
    }
  }

  showConflictDialog(conflict) {
    this.pendingConflict = conflict;
    if (this.conflictMessageEl) {
      this.conflictMessageEl.innerHTML = `Your cart already contains items from <strong>${conflict.currentRestaurant}</strong>. Would you like to clear your current cart and start an order from <strong>${conflict.newRestaurant}</strong>?`;
    }
    if (this.conflictModalEl) {
      this.conflictModalEl.classList.add('open');
      this.conflictModalEl.setAttribute('aria-hidden', 'false');
    }
  }

  hideConflictDialog() {
    this.pendingConflict = null;
    if (this.conflictModalEl) {
      this.conflictModalEl.classList.remove('open');
      this.conflictModalEl.setAttribute('aria-hidden', 'true');
    }
  }

  resetAllFilters() {
    this.state.search = '';
    this.state.cuisine = 'All';
    this.state.isVeg = false;
    this.state.sortBy = 'rating';
    this.state.page = 1;

    if (this.searchInput) this.searchInput.value = '';
    if (this.searchClearBtn) this.searchClearBtn.classList.remove('active');

    this.cuisineChips.forEach((chip) => {
      if (chip.getAttribute('data-cuisine') === 'All') {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    if (this.vegToggleBtn) {
      this.vegToggleBtn.classList.remove('active');
      this.vegToggleBtn.setAttribute('aria-pressed', 'false');
    }

    if (this.sortSelect) {
      this.sortSelect.value = 'rating';
    }

    this.fetchAndRenderRestaurants();
  }

  async fetchAndRenderRestaurants() {
    this.restaurantList.renderLoading(4);
    if (this.resultCountEl) {
      this.resultCountEl.textContent = 'Searching restaurants...';
    }

    try {
      const response = await api.getRestaurants({
        search: this.state.search,
        cuisine: this.state.cuisine,
        isVeg: this.state.isVeg,
        sortBy: this.state.sortBy,
        page: this.state.page,
        limit: this.state.limit
      });

      const restaurants = response.data || [];
      const total = response.meta?.total !== undefined ? response.meta.total : restaurants.length;

      if (this.resultCountEl) {
        this.resultCountEl.textContent = `Showing ${restaurants.length} of ${total} restaurants`;
      }

      if (restaurants.length === 0) {
        this.restaurantList.renderEmpty({
          onResetFilters: () => this.resetAllFilters()
        });
      } else {
        this.restaurantList.renderRestaurants(restaurants);
      }
    } catch (err) {
      if (this.resultCountEl) {
        this.resultCountEl.textContent = 'Error loading results';
      }
      this.restaurantList.renderError(err, () => this.fetchAndRenderRestaurants());
    }
  }

  async loadUserProfile() {
    try {
      const response = await api.getCustomerProfile();
      if (response?.data?.name && this.userProfileNameEl) {
        this.userProfileNameEl.textContent = response.data.name;
      }
    } catch {
      // Retain fallback user in navbar
    }
  }

  init() {
    this.loadUserProfile();
    this.fetchAndRenderRestaurants();
  }
}

// Start customer application once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new CustomerApp();
  app.init();
});