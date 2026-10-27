/**
 * Restaurant Details & Menu Modal Component
 * Displays restaurant information, category navigation, and categorized menu items
 */

export class RestaurantModal {
  constructor({ modalBackdropElement, api }) {
    this.modal = modalBackdropElement;
    this.api = api;
    this.currentRestaurant = null;
    this.currentMenuData = null;
    this.activeCategory = 'All';
    this.menuIsVegOnly = false;

    this.initEventListeners();
  }

  initEventListeners() {
    // Close button
    const closeBtn = this.modal.querySelector('#modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click outside card
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  isOpen() {
    return this.modal.classList.contains('open');
  }

  close() {
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.currentRestaurant = null;
    this.currentMenuData = null;
  }

  async open(restaurantId) {
    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const modalTitle = this.modal.querySelector('#modal-restaurant-name');
    const modalDesc = this.modal.querySelector('#modal-restaurant-desc');
    const modalTags = this.modal.querySelector('#modal-restaurant-tags');
    const menuTabsContainer = this.modal.querySelector('#modal-menu-tabs');
    const menuBody = this.modal.querySelector('#modal-menu-body');

    // Reset view to loading state
    if (modalTitle) modalTitle.textContent = 'Loading Restaurant Details...';
    if (modalDesc) modalDesc.textContent = '';
    if (modalTags) modalTags.innerHTML = '';
    if (menuTabsContainer) menuTabsContainer.innerHTML = '';
    if (menuBody) {
      menuBody.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: pulse 1s infinite;">🍲</div>
          <p>Fetching fresh menu...</p>
        </div>
      `;
    }

    try {
      // 1. Fetch restaurant details
      const restaurantResponse = await this.api.getRestaurantById(restaurantId);
      this.currentRestaurant = restaurantResponse.data;

      // 2. Fetch menu
      const menuResponse = await this.api.getRestaurantMenu(restaurantId, {
        isVeg: this.menuIsVegOnly ? 'true' : undefined
      });
      this.currentMenuData = menuResponse.data;

      // Render restaurant header & menu
      this.renderRestaurantHeader();
      this.renderMenu();
    } catch (err) {
      if (menuBody) {
        menuBody.innerHTML = `
          <div class="state-container">
            <div class="state-icon">⚠️</div>
            <h3 class="state-title">Failed to Load Menu</h3>
            <p class="state-message">${err?.message || 'Unable to retrieve menu details.'}</p>
            <button class="btn-outline" id="modal-retry-btn" type="button">Retry</button>
          </div>
        `;
        const retryBtn = menuBody.querySelector('#modal-retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => this.open(restaurantId));
        }
      }
    }
  }

  renderRestaurantHeader() {
    const r = this.currentRestaurant;
    if (!r) return;

    const modalTitle = this.modal.querySelector('#modal-restaurant-name');
    const modalDesc = this.modal.querySelector('#modal-restaurant-desc');
    const modalTags = this.modal.querySelector('#modal-restaurant-tags');

    if (modalTitle) modalTitle.textContent = r.name;
    if (modalDesc) modalDesc.textContent = r.description || '';

    const rating = r.rating ? Number(r.rating).toFixed(1) : 'New';
    const deliveryTime = r.deliveryTimeEstimate || `${r.deliveryTimeMinutes || 30} mins`;
    const costForTwo = r.costForTwo ? `₹${r.costForTwo} for two` : '₹500 for two';
    const address = r.address ? `${r.address.street}, ${r.address.city}` : '';
    const phone = r.contact?.phone || '';

    if (modalTags) {
      modalTags.innerHTML = `
        <span class="modal-info-pill" style="color: #b45309; font-weight: 700;">★ ${rating}</span>
        <span class="modal-info-pill">⏱ ${deliveryTime}</span>
        <span class="modal-info-pill">${costForTwo}</span>
        ${address ? `<span class="modal-info-pill">📍 ${address}</span>` : ''}
        ${phone ? `<span class="modal-info-pill">📞 ${phone}</span>` : ''}
      `;
    }
  }

  renderMenu() {
    const data = this.currentMenuData;
    const menuTabsContainer = this.modal.querySelector('#modal-menu-tabs');
    const menuBody = this.modal.querySelector('#modal-menu-body');

    if (!data || !data.categories || data.categories.length === 0) {
      if (menuTabsContainer) menuTabsContainer.innerHTML = '';
      if (menuBody) {
        menuBody.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🍽️</div>
            <h4 style="font-size: 1.1rem; margin-bottom: 0.25rem;">No Menu Items Available</h4>
            <p style="font-size: 0.9rem;">This restaurant currently has no items matching your criteria.</p>
          </div>
        `;
      }
      return;
    }

    // 1. Render Category Navigation Tabs
    const categories = data.categories;
    const tabsHtml = [
      `<button class="menu-tab-btn ${this.activeCategory === 'All' ? 'active' : ''}" data-cat="All" type="button">All Items</button>`,
      ...categories.map(
        (c) => `<button class="menu-tab-btn ${this.activeCategory === c.name ? 'active' : ''}" data-cat="${c.name}" type="button">${c.name} (${c.items.length})</button>`
      )
    ].join('');

    if (menuTabsContainer) {
      menuTabsContainer.innerHTML = tabsHtml;

      const tabBtns = menuTabsContainer.querySelectorAll('.menu-tab-btn');
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeCategory = btn.getAttribute('data-cat') || 'All';
          this.renderMenu();
        });
      });
    }

    // 2. Render Menu Categories & Items
    const displayCategories = this.activeCategory === 'All'
      ? categories
      : categories.filter((c) => c.name === this.activeCategory);

    let html = '';
    for (const cat of displayCategories) {
      html += `
        <section class="menu-category-section" id="cat-${encodeURIComponent(cat.name)}">
          <h4 class="menu-category-heading">
            ${cat.name}
            <span class="category-count-badge">${cat.items.length}</span>
          </h4>
          <div class="menu-items-grid">
            ${cat.items.map((item) => this.createMenuItemHtml(item)).join('')}
          </div>
        </section>
      `;
    }

    if (menuBody) {
      menuBody.innerHTML = html;
    }
  }

  createMenuItemHtml(item) {
    const isVeg = Boolean(item.isVeg);
    const isAvailable = item.isAvailable !== false;
    const vegIconClass = isVeg ? 'veg' : 'non-veg';
    const vegLabel = isVeg ? 'Vegetarian' : 'Non-Vegetarian';

    const availabilityNotice = isAvailable
      ? ''
      : '<span class="item-status-badge">Sold Out</span>';

    return `
      <div class="menu-item-card ${!isAvailable ? 'out-of-stock' : ''}">
        <div class="item-info">
          <span class="veg-icon ${vegIconClass}" title="${vegLabel}" aria-label="${vegLabel}"></span>
          <h5 class="item-name">${item.name}</h5>
          <div class="item-price">₹${item.price}</div>
          ${item.description ? `<p class="item-desc">${item.description}</p>` : ''}
        </div>
        <div class="item-action-wrapper">
          ${availabilityNotice}
        </div>
      </div>
    `;
  }
}
