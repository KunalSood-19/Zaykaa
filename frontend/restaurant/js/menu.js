import api from '../../shared/js/api.js';
import { formatPaise, rupeesToPaise, escapeHtml, showToast } from '../../shared/js/utils.js';

export class MenuManager {
  /**
   * @param {() => object|null} getRestaurantFn
   */
  constructor(getRestaurantFn) {
    this.getRestaurant = getRestaurantFn;
    this.menuItems = [];
    this.selectedCategory = 'All';
    this.searchQuery = '';
    this.editingItemId = null;

    this.bindEvents();
  }

  bindEvents() {
    // Add Item button opens modal
    const btnOpenAdd = document.getElementById('btn-open-add-menu');
    if (btnOpenAdd) {
      btnOpenAdd.addEventListener('click', () => this.openItemModal());
    }

    // Modal form submission
    const form = document.getElementById('menu-item-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Category filter tabs
    const categoryTabs = document.querySelectorAll('.menu-category-tab');
    categoryTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        categoryTabs.forEach((t) => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedCategory = e.currentTarget.dataset.category || 'All';
        this.render();
      });
    });

    // Search input
    const searchInput = document.getElementById('menu-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    // Modal close buttons
    const modalCloseButtons = document.querySelectorAll('#menu-modal .modal-close, #menu-modal .btn-cancel');
    modalCloseButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.closeItemModal());
    });
  }

  /**
   * Loads menu items for the current restaurant from backend.
   */
  async loadMenu() {
    const restaurant = this.getRestaurant();
    if (!restaurant?.id) {
      this.menuItems = [];
      this.render();
      return;
    }

    const container = document.getElementById('menu-items-container');
    if (container) {
      container.innerHTML = `
        <div class="loading-block">
          <span class="spinner"></span>
          <span>Loading menu catalog...</span>
        </div>
      `;
    }

    try {
      const items = await api.get(`/api/restaurants/${restaurant.id}/menu`);
      this.menuItems = Array.isArray(items) ? items : [];
      this.render();
    } catch (err) {
      showToast(err.message || 'Failed to load menu items', 'error');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">⚠️</span>
            <div class="empty-state-title">Unable to load menu</div>
            <div class="empty-state-desc">${escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" id="btn-retry-menu">Try Again</button>
          </div>
        `;
        document.getElementById('btn-retry-menu')?.addEventListener('click', () => this.loadMenu());
      }
    }
  }

  /**
   * Renders filtered menu items into the grid.
   */
  render() {
    const container = document.getElementById('menu-items-container');
    if (!container) return;

    let filtered = this.menuItems;

    // Filter by category
    if (this.selectedCategory !== 'All') {
      filtered = filtered.filter((i) => i.category === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(this.searchQuery));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-state-icon">🍽️</span>
          <div class="empty-state-title">No menu items found</div>
          <div class="empty-state-desc">
            ${this.searchQuery || this.selectedCategory !== 'All'
              ? 'Try adjusting your search or category filter.'
              : 'Add your first dish to start receiving orders.'}
          </div>
          ${!this.searchQuery && this.selectedCategory === 'All'
            ? `<button class="btn btn-primary" onclick="document.getElementById('btn-open-add-menu').click()">Add First Dish</button>`
            : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((item) => {
      const isAvailable = item.isAvailable !== false;
      const imageUrl = item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';

      return `
        <article class="menu-card" data-id="${item.id}">
          <img class="menu-card-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';" />
          <div class="menu-card-content">
            <div class="menu-card-header">
              <div>
                <span class="dish-category">${escapeHtml(item.category)}</span>
                <h3 class="dish-name">${escapeHtml(item.name)}</h3>
              </div>
              <span class="dish-price">${formatPaise(item.price)}</span>
            </div>
            <p class="dish-desc">${escapeHtml(item.description || 'Delicious freshly prepared dish.')}</p>
          </div>
          <div class="menu-card-footer">
            <label class="switch-label">
              <div class="switch">
                <input type="checkbox" class="toggle-availability" data-id="${item.id}" ${isAvailable ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </div>
              <span>${isAvailable ? 'In Stock' : 'Out of Stock'}</span>
            </label>
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn btn-secondary btn-sm btn-edit" data-id="${item.id}" title="Edit Dish">
                Edit
              </button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${item.id}" title="Delete Dish">
                Delete
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach row button listeners
    container.querySelectorAll('.toggle-availability').forEach((chk) => {
      chk.addEventListener('change', (e) => this.handleToggleAvailability(e.target.dataset.id, e.target.checked));
    });

    container.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => this.openItemModal(e.currentTarget.dataset.id));
    });

    container.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleDelete(e.currentTarget.dataset.id));
    });
  }

  /**
   * Opens the Add/Edit menu item modal.
   * @param {string} [itemId]
   */
  openItemModal(itemId = null) {
    this.editingItemId = itemId;
    const modal = document.getElementById('menu-modal');
    const title = document.getElementById('menu-modal-title');
    const form = document.getElementById('menu-item-form');
    if (!modal || !form) return;

    if (itemId) {
      const item = this.menuItems.find((i) => i.id === itemId);
      if (!item) return;

      title.textContent = 'Edit Menu Item';
      form.elements['name'].value = item.name;
      form.elements['category'].value = item.category;
      form.elements['price'].value = (item.price / 100).toFixed(2);
      form.elements['description'].value = item.description || '';
      form.elements['imageUrl'].value = item.imageUrl || '';
      form.elements['isAvailable'].checked = item.isAvailable !== false;
    } else {
      title.textContent = 'Add New Dish';
      form.reset();
      form.elements['isAvailable'].checked = true;
    }

    modal.classList.add('active');
  }

  closeItemModal() {
    const modal = document.getElementById('menu-modal');
    if (modal) modal.classList.remove('active');
    this.editingItemId = null;
  }

  /**
   * Handles Add / Edit form submit.
   * Converts Rupee input to integer paise.
   *
   * @param {Event} e
   */
  async handleFormSubmit(e) {
    e.preventDefault();
    const restaurant = this.getRestaurant();
    if (!restaurant?.id) {
      showToast('Please create a restaurant profile before adding menu items', 'error');
      return;
    }

    const form = e.target;
    const name = form.elements['name'].value.trim();
    const category = form.elements['category'].value;
    const rawPrice = form.elements['price'].value;
    const description = form.elements['description'].value.trim();
    const imageUrl = form.elements['imageUrl'].value.trim();
    const isAvailable = form.elements['isAvailable'].checked;

    // Validation
    if (!name || name.length < 2 || name.length > 80) {
      showToast('Dish title must be between 2 and 80 characters', 'error');
      return;
    }

    const priceInPaise = rupeesToPaise(rawPrice);
    if (isNaN(priceInPaise) || priceInPaise <= 0) {
      showToast('Please enter a valid positive price in Rupees', 'error');
      return;
    }

    const payload = {
      name,
      category,
      price: priceInPaise, // strictly integer paise to backend
      description,
      ...(imageUrl ? { imageUrl } : {}),
      isAvailable,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;
    }

    try {
      if (this.editingItemId) {
        await api.put(`/api/restaurants/${restaurant.id}/menu/${this.editingItemId}`, payload);
        showToast('Menu item updated successfully', 'success');
      } else {
        await api.post(`/api/restaurants/${restaurant.id}/menu`, payload);
        showToast('Menu item added successfully', 'success');
      }

      this.closeItemModal();
      await this.loadMenu();
    } catch (err) {
      showToast(err.message || 'Failed to save menu item', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = this.editingItemId ? 'Update Dish' : 'Add Dish';
      }
    }
  }

  /**
   * Toggles item availability (in stock / out of stock).
   *
   * @param {string} itemId
   * @param {boolean} isAvailable
   */
  async handleToggleAvailability(itemId, isAvailable) {
    const restaurant = this.getRestaurant();
    if (!restaurant?.id) return;

    try {
      await api.patch(`/api/restaurants/${restaurant.id}/menu/${itemId}/availability`, {
        isAvailable,
      });

      // Update local state without full reload
      const item = this.menuItems.find((i) => i.id === itemId);
      if (item) item.isAvailable = isAvailable;

      showToast(`'${item?.name || 'Dish'}' is now ${isAvailable ? 'In Stock' : 'Out of Stock'}`, 'info');
      this.render();
    } catch (err) {
      showToast(err.message || 'Failed to update availability', 'error');
      this.render(); // revert checkbox
    }
  }

  /**
   * Deletes a menu item after confirmation.
   *
   * @param {string} itemId
   */
  async handleDelete(itemId) {
    const restaurant = this.getRestaurant();
    if (!restaurant?.id) return;

    const item = this.menuItems.find((i) => i.id === itemId);
    const dishName = item ? item.name : 'this dish';

    if (!confirm(`Are you sure you want to permanently delete "${dishName}" from your menu?`)) {
      return;
    }

    try {
      await api.delete(`/api/restaurants/${restaurant.id}/menu/${itemId}`);
      showToast(`"${dishName}" deleted`, 'success');
      this.menuItems = this.menuItems.filter((i) => i.id !== itemId);
      this.render();
    } catch (err) {
      showToast(err.message || 'Failed to delete dish', 'error');
    }
  }
}
