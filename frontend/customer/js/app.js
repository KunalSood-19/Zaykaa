/**
 * Zaykaa Customer Portal — Main Application Orchestrator
 * Coordinates desktop sidebar, mobile views, restaurant discovery, cuisine filters,
 * cart, checkout, order history, live tracking, theme switching, favourites & profile.
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
      limit: 20,
      currentView: 'home',
      currentLocation: '91, Model Town, Ludhiana'
    };

    this.debounceTimer = null;
    this.pendingConflict = null;
    this.cachedRestaurants = [];

    this.initTheme();
    this.initElements();
    this.initComponents();
    this.bindEvents();
    this.handleRouting();
  }

  /**
   * Theme Manager (Gold Leaf <-> Midnight Leaf)
   */
  initTheme() {
    const savedTheme = localStorage.getItem('zaykaa_theme') || 'light';
    this.applyTheme(savedTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zaykaa_theme', theme);

    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  initElements() {
    // Navigation items
    this.sidebar = document.getElementById('app-sidebar');
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.locationPickerBtn = document.getElementById('location-picker-btn');
    this.headerLocationName = document.getElementById('header-location-name');

    // Sidebar Nav Items
    this.navBtnHome = document.getElementById('nav-btn-home');
    this.navBtnBrowse = document.getElementById('nav-btn-browse');
    this.navBtnOrders = document.getElementById('nav-btn-orders');
    this.navBtnFavourites = document.getElementById('nav-btn-favourites');
    this.navBtnWallet = document.getElementById('nav-btn-wallet');
    this.navBtnProfile = document.getElementById('nav-btn-profile');
    this.sidebarSettingsBtn = document.getElementById('sidebar-settings-btn');
    this.sidebarSignoutBtn = document.getElementById('sidebar-signout-btn');

    // Mobile Bottom Nav Items
    this.mobNavHome = document.getElementById('mob-nav-home');
    this.mobNavOrders = document.getElementById('mob-nav-orders');
    this.mobNavFavourites = document.getElementById('mob-nav-favourites');
    this.mobNavProfile = document.getElementById('mob-nav-profile');

    // View Containers
    this.viewRestaurants = document.getElementById('view-restaurants');
    this.viewOrders = document.getElementById('view-orders');
    this.viewFavourites = document.getElementById('view-favourites');
    this.viewWallet = document.getElementById('view-wallet');
    this.viewProfile = document.getElementById('view-profile');

    // Discovery Controls
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.cuisineTiles = document.querySelectorAll('.cuisine-tile');
    this.vegToggleBtn = document.getElementById('veg-only-toggle');
    this.sortSelect = document.getElementById('sort-select');
    this.resultCountEl = document.getElementById('result-count');
    this.restaurantGridEl = document.getElementById('restaurant-grid');
    this.btnViewAll = document.getElementById('btn-view-all-restaurants');

    // Offers & Welcome Elements
    this.btnExploreOffers = document.getElementById('btn-explore-offers');
    this.offersModal = document.getElementById('offers-modal');
    this.offersCloseBtn = document.getElementById('offers-close-btn');
    this.mobileWelcomeModal = document.getElementById('mobile-welcome-modal');
    this.splashGetStartedBtn = document.getElementById('splash-get-started-btn');
    this.splashCloseBtn = document.getElementById('splash-close-btn');

    // Favourites Grid & Empty State
    this.favouritesGrid = document.getElementById('favourites-grid');
    this.favouritesEmpty = document.getElementById('favourites-empty');
    this.btnFavouritesExplore = document.getElementById('btn-favourites-explore');

    // Profile Form Elements
    this.profileForm = document.getElementById('profile-edit-form');
    this.profileNameInput = document.getElementById('profile-input-name');
    this.profileEmailInput = document.getElementById('profile-input-email');
    this.profilePhoneInput = document.getElementById('profile-input-phone');
    this.profileStreetInput = document.getElementById('profile-input-street');
    this.profileCityInput = document.getElementById('profile-input-city');
    this.profilePincodeInput = document.getElementById('profile-input-pincode');
    this.profileAlert = document.getElementById('profile-alert');

    // Header User Controls
    this.userProfileBadge = document.getElementById('user-profile-badge');
    this.userDropdownMenu = document.getElementById('user-dropdown-menu');
    this.dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
    this.userProfileNameEl = document.getElementById('user-profile-name');
    this.dropdownUserNameEl = document.getElementById('dropdown-user-name');
    this.dropdownUserEmailEl = document.getElementById('dropdown-user-email');
    this.navLoginBtn = document.getElementById('nav-login-btn');

    // Cart & Sticky Mobile Cart
    this.navCartBtn = document.getElementById('nav-cart-btn');
    this.navCartCountEl = document.getElementById('nav-cart-count');
    this.cartDrawerEl = document.getElementById('cart-drawer');
    this.mobileStickyCartBar = document.getElementById('mobile-sticky-cart-bar');
    this.stickyCartCount = document.getElementById('sticky-cart-count');
    this.stickyCartTotal = document.getElementById('sticky-cart-total');
    this.stickyCartViewBtn = document.getElementById('sticky-cart-view-btn');

    // Modals
    this.modalBackdropEl = document.getElementById('restaurant-modal');
    this.checkoutModalEl = document.getElementById('checkout-modal');
    this.confirmationModalEl = document.getElementById('order-confirmation-modal');
    this.conflictModalEl = document.getElementById('cart-conflict-modal');
    this.conflictMessageEl = document.getElementById('cart-conflict-message');
    this.conflictCancelBtn = document.getElementById('conflict-cancel-btn');
    this.conflictConfirmBtn = document.getElementById('conflict-confirm-btn');
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
      },
      onToggleFavourite: (restaurantId, isFav) => {
        if (this.state.currentView === 'favourites') {
          this.renderFavouritesView();
        }
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
        this.navigateTo('home');
      },
      onTrackOrder: (order) => {
        this.navigateTo('orders');
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
        this.navigateTo('home');
      }
    });

    // 7. Order Details & Live Tracking Modal
    this.orderDetailsModal = new OrderDetailsModal({
      modalElement: this.orderDetailsModalEl,
      cancelModalElement: this.orderCancelConfirmModalEl,
      api,
      onOrderCancelled: () => {
        this.orderHistory.loadOrders();
      }
    });

    // 8. Auth Modal & Session Management
    if (this.authModalEl) {
      this.authModal = new AuthModal({
        modalElement: this.authModalEl,
        api,
        onAuthChange: (user) => {
          if (user) {
            this.updateUserBadge(user);
          } else {
            this.clearUserBadge();
          }
          if (this.state.currentView === 'orders') {
            this.orderHistory.loadOrders();
          }
        }
      });
    }
  }

  bindEvents() {
    // Theme Switcher Toggle
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Mobile Menu Toggle
    if (this.mobileMenuBtn && this.sidebar) {
      this.mobileMenuBtn.addEventListener('click', () => {
        this.sidebar.classList.toggle('sidebar-open');
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', (e) => {
        if (
          this.sidebar.classList.contains('sidebar-open') &&
          !this.sidebar.contains(e.target) &&
          !this.mobileMenuBtn.contains(e.target)
        ) {
          this.sidebar.classList.remove('sidebar-open');
        }
      });
    }

    // Location Switcher
    if (this.locationPickerBtn) {
      this.locationPickerBtn.addEventListener('click', () => {
        if (this.state.currentLocation.includes('Ludhiana')) {
          this.state.currentLocation = '45, Indiranagar, Bengaluru';
        } else {
          this.state.currentLocation = '91, Model Town, Ludhiana';
        }
        if (this.headerLocationName) {
          this.headerLocationName.textContent = this.state.currentLocation;
        }
      });
    }

    // URL Hash Routing
    window.addEventListener('hashchange', () => {
      this.handleRouting();
    });

    // Navigation links
    const navBindings = [
      { el: this.navBtnHome, view: 'home' },
      { el: this.navBtnBrowse, view: 'browse' },
      { el: this.navBtnOrders, view: 'orders' },
      { el: this.navBtnFavourites, view: 'favourites' },
      { el: this.navBtnWallet, view: 'wallet' },
      { el: this.navBtnProfile, view: 'profile' },
      { el: this.mobNavHome, view: 'home' },
      { el: this.mobNavOrders, view: 'orders' },
      { el: this.mobNavFavourites, view: 'favourites' },
      { el: this.mobNavProfile, view: 'profile' }
    ];

    navBindings.forEach(({ el, view }) => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = view;
          if (this.sidebar) this.sidebar.classList.remove('sidebar-open');
        });
      }
    });

    // View All button
    if (this.btnViewAll) {
      this.btnViewAll.addEventListener('click', () => {
        this.resetFilters();
        this.restaurantGridEl?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Explore Favourites action
    if (this.btnFavouritesExplore) {
      this.btnFavouritesExplore.addEventListener('click', () => {
        this.navigateTo('home');
      });
    }

    // Sidebar secondary buttons
    if (this.sidebarSettingsBtn) {
      this.sidebarSettingsBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    if (this.sidebarSignoutBtn) {
      this.sidebarSignoutBtn.addEventListener('click', () => {
        if (this.authModal) {
          this.authModal.handleLogout();
        }
      });
    }

    // Deals / Offers Modal
    if (this.btnExploreOffers && this.offersModal) {
      this.btnExploreOffers.addEventListener('click', () => {
        this.offersModal.classList.add('open');
      });
    }

    if (this.offersCloseBtn && this.offersModal) {
      this.offersCloseBtn.addEventListener('click', () => {
        this.offersModal.classList.remove('open');
      });
    }

    // Mobile Welcome Splash Modal
    if (this.splashGetStartedBtn && this.mobileWelcomeModal) {
      this.splashGetStartedBtn.addEventListener('click', () => {
        this.mobileWelcomeModal.classList.remove('open');
        localStorage.setItem('zaykaa_welcomed', 'true');
      });
    }

    if (this.splashCloseBtn && this.mobileWelcomeModal) {
      this.splashCloseBtn.addEventListener('click', () => {
        this.mobileWelcomeModal.classList.remove('open');
      });
    }

    // User Avatar & Dropdown Menu
    if (this.userProfileBadge && this.userDropdownMenu) {
      this.userProfileBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = this.userDropdownMenu.style.display === 'block';
        this.userDropdownMenu.style.display = isOpen ? 'none' : 'block';
      });

      document.addEventListener('click', () => {
        this.userDropdownMenu.style.display = 'none';
      });
    }

    if (this.dropdownLogoutBtn) {
      this.dropdownLogoutBtn.addEventListener('click', () => {
        if (this.authModal) {
          this.authModal.handleLogout();
        }
      });
    }

    // Cart Button Triggers
    if (this.navCartBtn) {
      this.navCartBtn.addEventListener('click', () => {
        this.cartDrawer.open();
      });
    }

    if (this.stickyCartViewBtn) {
      this.stickyCartViewBtn.addEventListener('click', () => {
        this.cartDrawer.open();
      });
    }

    // Cart Synchronization
    cart.subscribe((cartState, totals) => {
      this.updateCartBadges(cartState, totals);
    });
    this.updateCartBadges(cart.getCart(), cart.getTotals());

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

    // Search Input Debouncing
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(this.debounceTimer);
        const val = e.target.value;

        if (val.trim()) {
          this.searchClearBtn?.classList.add('visible');
        } else {
          this.searchClearBtn?.classList.remove('visible');
        }

        this.debounceTimer = setTimeout(() => {
          this.state.search = val;
          this.fetchRestaurants();
        }, 300);
      });
    }

    // Search Clear Button
    if (this.searchClearBtn) {
      this.searchClearBtn.addEventListener('click', () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchInput.focus();
        }
        this.state.search = '';
        this.searchClearBtn.classList.remove('visible');
        this.fetchRestaurants();
      });
    }

    // Cuisine Category Tiles Filtering
    this.cuisineTiles.forEach((tile) => {
      tile.addEventListener('click', () => {
        const selectedCuisine = tile.dataset.cuisine;
        const isAlreadyActive = tile.classList.contains('active') && this.state.cuisine === selectedCuisine;

        this.cuisineTiles.forEach((t) => t.classList.remove('active'));

        if (isAlreadyActive) {
          this.state.cuisine = 'All';
        } else {
          tile.classList.add('active');
          this.state.cuisine = selectedCuisine;
        }

        this.fetchRestaurants();
      });
    });

    // Veg Only Filter Toggle
    if (this.vegToggleBtn) {
      this.vegToggleBtn.addEventListener('click', () => {
        this.state.isVeg = !this.state.isVeg;
        const isActive = this.state.isVeg;
        this.vegToggleBtn.classList.toggle('active', isActive);
        this.vegToggleBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        this.fetchRestaurants();
      });
    }

    // Sorting Dropdown
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.fetchRestaurants();
      });
    }

    // Profile Form Save
    if (this.profileForm) {
      this.profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveProfile();
      });
    }
  }

  updateCartBadges(cartState, totals) {
    const count = cart.getItemCount();
    const total = totals?.total ?? (cart.getTotals().total);

    if (this.navCartCountEl) {
      this.navCartCountEl.textContent = count;
    }

    if (this.mobileStickyCartBar) {
      if (count > 0 && window.innerWidth <= 900) {
        this.mobileStickyCartBar.style.display = 'flex';
        if (this.stickyCartCount) this.stickyCartCount.textContent = `${count} ${count === 1 ? 'Item' : 'Items'}`;
        if (this.stickyCartTotal) this.stickyCartTotal.textContent = `₹${total}`;
      } else {
        this.mobileStickyCartBar.style.display = 'none';
      }
    }
  }

  handleRouting() {
    const hash = (window.location.hash || '').replace(/^#/, '');

    if (hash === 'orders') {
      this.navigateTo('orders');
    } else if (hash.startsWith('order-')) {
      const orderId = hash.replace('order-', '');
      this.navigateTo('orders');
      if (orderId) {
        this.orderDetailsModal.open(orderId);
      }
    } else if (hash === 'browse') {
      this.navigateTo('home');
      this.searchInput?.focus();
      this.restaurantGridEl?.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === 'favourites') {
      this.navigateTo('favourites');
    } else if (hash === 'wallet') {
      this.navigateTo('wallet');
    } else if (hash === 'profile') {
      this.navigateTo('profile');
    } else {
      this.navigateTo('home');
    }
  }

  navigateTo(viewName) {
    this.state.currentView = viewName;

    // View Containers
    const views = [
      { id: 'home', el: this.viewRestaurants },
      { id: 'orders', el: this.viewOrders },
      { id: 'favourites', el: this.viewFavourites },
      { id: 'wallet', el: this.viewWallet },
      { id: 'profile', el: this.viewProfile }
    ];

    views.forEach(({ id, el }) => {
      if (el) {
        el.style.display = id === viewName ? 'block' : 'none';
      }
    });

    // Update Sidebar Navigation state
    const sidebarNavMap = {
      home: this.navBtnHome,
      browse: this.navBtnBrowse,
      orders: this.navBtnOrders,
      favourites: this.navBtnFavourites,
      wallet: this.navBtnWallet,
      profile: this.navBtnProfile
    };

    Object.entries(sidebarNavMap).forEach(([key, btn]) => {
      if (btn) {
        btn.classList.toggle('active', key === viewName);
        if (key === viewName) {
          btn.setAttribute('aria-current', 'page');
        } else {
          btn.removeAttribute('aria-current');
        }
      }
    });

    // Update Mobile Bottom Nav state
    if (this.mobNavHome) this.mobNavHome.classList.toggle('active', viewName === 'home');
    if (this.mobNavOrders) this.mobNavOrders.classList.toggle('active', viewName === 'orders');
    if (this.mobNavFavourites) this.mobNavFavourites.classList.toggle('active', viewName === 'favourites');
    if (this.mobNavProfile) this.mobNavProfile.classList.toggle('active', viewName === 'profile');

    // Trigger view-specific loads
    if (viewName === 'orders') {
      this.orderHistory.loadOrders();
    } else if (viewName === 'favourites') {
      this.renderFavouritesView();
    } else if (viewName === 'profile') {
      this.loadCustomerProfile();
    }
  }

  renderFavouritesView() {
    if (!this.favouritesGrid) return;
    const favIds = this.restaurantList.getFavourites();

    if (!favIds || favIds.length === 0) {
      this.favouritesGrid.innerHTML = '';
      if (this.favouritesEmpty) this.favouritesEmpty.style.display = 'flex';
      return;
    }

    if (this.favouritesEmpty) this.favouritesEmpty.style.display = 'none';

    const favRestaurants = this.cachedRestaurants.filter((r) => favIds.includes(r.id));
    if (favRestaurants.length > 0) {
      this.favouritesGrid.innerHTML = favRestaurants.map((r) => this.restaurantList.createCardHtml(r)).join('');
      // Attach click listeners to cards
      this.attachCardClickListeners(this.favouritesGrid);
    } else {
      // Re-fetch to ensure we have current restaurants
      api.getRestaurants({ limit: 50 }).then((res) => {
        this.cachedRestaurants = res.data || [];
        const matches = this.cachedRestaurants.filter((r) => favIds.includes(r.id));
        if (matches.length > 0) {
          this.favouritesGrid.innerHTML = matches.map((r) => this.restaurantList.createCardHtml(r)).join('');
          this.attachCardClickListeners(this.favouritesGrid);
        } else {
          if (this.favouritesEmpty) this.favouritesEmpty.style.display = 'flex';
        }
      }).catch(() => {
        if (this.favouritesEmpty) this.favouritesEmpty.style.display = 'flex';
      });
    }
  }

  attachCardClickListeners(container) {
    const cards = container.querySelectorAll('.restaurant-card');
    cards.forEach((card) => {
      const restaurantId = card.getAttribute('data-id');
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-favourite')) return;
        if (restaurantId) this.restaurantModal.open(restaurantId);
      });

      const favBtn = card.querySelector('.btn-card-favourite');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowFav = this.restaurantList.toggleFavourite(restaurantId);
          favBtn.classList.toggle('active', isNowFav);
          favBtn.setAttribute('aria-pressed', isNowFav ? 'true' : 'false');
          this.renderFavouritesView();
        });
      }
    });
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

    // Check if mobile user wants welcome splash
    if (window.innerWidth <= 768 && !localStorage.getItem('zaykaa_welcomed')) {
      if (this.mobileWelcomeModal) {
        this.mobileWelcomeModal.classList.add('open');
      }
    }
  }

  updateUserBadge(user) {
    if (this.userProfileNameEl) this.userProfileNameEl.textContent = user.name || 'Customer';
    if (this.dropdownUserNameEl) this.dropdownUserNameEl.textContent = user.name || 'Customer';
    if (this.dropdownUserEmailEl) this.dropdownUserEmailEl.textContent = user.email || '';
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && user.name) {
      avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
  }

  clearUserBadge() {
    if (this.userProfileNameEl) this.userProfileNameEl.textContent = 'Sign In';
    if (this.dropdownUserNameEl) this.dropdownUserNameEl.textContent = 'Guest User';
    if (this.dropdownUserEmailEl) this.dropdownUserEmailEl.textContent = 'guest@zaykaa.com';
  }

  async loadCustomerProfile() {
    try {
      const response = await api.getCustomerProfile();
      if (response && response.data) {
        const profile = response.data;
        this.updateUserBadge(profile);

        if (this.profileNameInput) this.profileNameInput.value = profile.name || '';
        if (this.profileEmailInput) this.profileEmailInput.value = profile.email || '';
        if (this.profilePhoneInput) this.profilePhoneInput.value = profile.phone || '';

        const primaryAddr = profile.addresses?.[0] || {};
        if (this.profileStreetInput) this.profileStreetInput.value = primaryAddr.street || '';
        if (this.profileCityInput) this.profileCityInput.value = primaryAddr.city || 'Ludhiana';
        if (this.profilePincodeInput) this.profilePincodeInput.value = primaryAddr.pincode || '141002';
      }
    } catch (err) {
      console.warn('Could not load customer profile details:', err);
    }
  }

  async handleSaveProfile() {
    const name = this.profileNameInput?.value.trim();
    const phone = this.profilePhoneInput?.value.trim();
    const street = this.profileStreetInput?.value.trim();
    const city = this.profileCityInput?.value.trim();
    const pincode = this.profilePincodeInput?.value.trim();

    if (!name || !phone || !street || !city || !pincode) {
      this.showProfileAlert('Please fill in all required profile fields.', 'danger');
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      this.showProfileAlert('PIN code must be exactly 6 digits.', 'danger');
      return;
    }

    try {
      const payload = {
        name,
        phone,
        addresses: [
          {
            street,
            city,
            pincode,
            isDefault: true
          }
        ]
      };

      await api.updateCustomerProfile(payload);
      this.updateUserBadge({ name, email: this.profileEmailInput?.value });
      this.showProfileAlert('Profile updated successfully!', 'success');
    } catch (err) {
      this.showProfileAlert(err.message || 'Failed to update profile.', 'danger');
    }
  }

  showProfileAlert(message, type = 'success') {
    if (!this.profileAlert) return;
    this.profileAlert.textContent = message;
    this.profileAlert.style.display = 'block';
    if (type === 'success') {
      this.profileAlert.style.background = '#EBF5F0';
      this.profileAlert.style.color = '#26794C';
      this.profileAlert.style.border = '1px solid #26794C';
    } else {
      this.profileAlert.style.background = '#FDF2F2';
      this.profileAlert.style.color = '#C53030';
      this.profileAlert.style.border = '1px solid #C53030';
    }

    setTimeout(() => {
      this.profileAlert.style.display = 'none';
    }, 4000);
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
      this.cachedRestaurants = restaurants;
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
    if (this.cuisineTiles) {
      this.cuisineTiles.forEach((tile) => tile.classList.remove('active'));
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

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CustomerApp();
  app.init();
});