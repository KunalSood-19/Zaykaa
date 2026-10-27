import api from '../../shared/js/api.js';
import { escapeHtml, showToast } from '../../shared/js/utils.js';
import { getSavedTheme, setTheme, getActiveTheme } from '../../shared/js/theme.js';

export class ProfileManager {
  /**
   * @param {(restaurant: object|null) => void} onRestaurantLoadedFn
   */
  constructor(onRestaurantLoadedFn) {
    this.onRestaurantLoaded = onRestaurantLoadedFn;
    this.restaurant = null;

    this.bindEvents();
  }

  bindEvents() {
    // Header toggle open/closed
    const toggleHeaderBtn = document.getElementById('header-toggle-open');
    if (toggleHeaderBtn) {
      toggleHeaderBtn.addEventListener('click', () => this.toggleOpenStatus());
    }
  }

  /**
   * Loads restaurant profile from backend.
   * Handles 404 gracefully by rendering onboarding view.
   *
   * @returns {Promise<object|null>}
   */
  async loadProfile() {
    try {
      const res = await api.get('/api/restaurants/mine');
      this.restaurant = res;
      this.render();
      if (typeof this.onRestaurantLoaded === 'function') {
        this.onRestaurantLoaded(this.restaurant);
      }
      return this.restaurant;
    } catch (err) {
      if (err.status === 404) {
        // No restaurant profile created yet
        this.restaurant = null;
        this.renderOnboarding();
        if (typeof this.onRestaurantLoaded === 'function') {
          this.onRestaurantLoaded(null);
        }
        return null;
      }
      showToast(err.message || 'Failed to load restaurant profile', 'error');
      return null;
    }
  }

  /**
   * Renders the onboarding creation view when no restaurant profile exists yet.
   */
  renderOnboarding() {
    const container = document.getElementById('profile-container');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width: 680px; margin: 0 auto; background-color: var(--bg-card); border: 1px solid var(--border-gold); border-radius: var(--radius-lg); padding: 2.5rem 2rem; box-shadow: var(--shadow-lg);">
        <div style="text-align: center; margin-bottom: 2rem;">
          <div style="font-size: 3.5rem; line-height: 1; margin-bottom: 0.75rem;">🌿 🏪</div>
          <div class="badge badge-gold-leaf" style="margin-bottom: 0.5rem;">Zaykaa Gold Leaf Kitchen Network</div>
          <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem;">Register Your Restaurant</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            Set up your restaurant profile on Zaykaa to start publishing your menu and receiving customer orders.
          </p>
        </div>

        <form id="restaurant-create-form">
          <div class="form-group">
            <label class="form-label" for="onboard-name">Restaurant Name <span class="required">*</span></label>
            <input type="text" id="onboard-name" name="name" class="form-input" placeholder="e.g., Royal Spice Symphony" required minlength="3" maxlength="100" />
          </div>

          <div class="form-group">
            <label class="form-label" for="onboard-desc">Description</label>
            <textarea id="onboard-desc" name="description" class="form-textarea" placeholder="Share a few words about your signature culinary dishes and kitchen history..." maxlength="300"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="onboard-cuisines">Cuisine Types (comma separated) <span class="required">*</span></label>
            <input type="text" id="onboard-cuisines" name="cuisineTypes" class="form-input" placeholder="North Indian, Mughlai, Biryani" required />
            <span class="form-hint">Separate multiple cuisines with commas</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="onboard-street">Street Address <span class="required">*</span></label>
            <input type="text" id="onboard-street" name="street" class="form-input" placeholder="123 Palace Road, Indiranagar" required minlength="3" maxlength="150" />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="onboard-city">City <span class="required">*</span></label>
              <input type="text" id="onboard-city" name="city" class="form-input" placeholder="Bengaluru" required minlength="2" maxlength="60" />
            </div>
            <div class="form-group">
              <label class="form-label" for="onboard-pincode">Pincode (6 digits) <span class="required">*</span></label>
              <input type="text" id="onboard-pincode" name="pincode" class="form-input" placeholder="560001" required pattern="[1-9][0-9]{5}" maxlength="6" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="onboard-phone">Phone Number <span class="required">*</span></label>
              <input type="tel" id="onboard-phone" name="phone" class="form-input" placeholder="+91 98765 43210" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="onboard-img">Banner Image URL</label>
              <input type="url" id="onboard-img" name="imageUrl" class="form-input" placeholder="https://images.unsplash.com/..." />
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.85rem; font-size: 1rem;">
            Create Restaurant Profile
          </button>
        </form>
      </div>
    `;

    document.getElementById('restaurant-create-form')?.addEventListener('submit', (e) => this.handleCreate(e));
  }

  /**
   * Renders the view and edit profile form.
   */
  render() {
    const container = document.getElementById('profile-container');
    if (!container || !this.restaurant) return;

    const r = this.restaurant;
    const cuisines = Array.isArray(r.cuisineTypes) ? r.cuisineTypes.join(', ') : '';
    const addr = r.address || {};
    const bannerUrl = r.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
    const isOpen = r.isOpen !== false;
    const savedTheme = getSavedTheme();

    container.innerHTML = `
      <div class="profile-container">
        <img class="profile-banner" src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(r.name)}" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';" />

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">${escapeHtml(r.name)}</h2>
              <span class="status-indicator ${isOpen ? 'open' : 'closed'}">
                <span class="indicator-dot"></span>
                <span class="indicator-text">${isOpen ? 'Kitchen Open' : 'Kitchen Closed'}</span>
              </span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">
              Restaurant ID: <code style="font-family: var(--font-mono);">${escapeHtml(r.id)}</code> &bull;
              Cuisines: ${escapeHtml(cuisines || 'Multi-cuisine')}
            </div>
          </div>

          <button type="button" class="btn ${isOpen ? 'btn-danger' : 'btn-success'}" id="btn-toggle-store-status">
            ${isOpen ? 'Close Kitchen for Orders' : 'Open Kitchen for Orders'}
          </button>
        </div>

        <form id="restaurant-edit-form">
          <div class="form-group">
            <label class="form-label" for="edit-name">Restaurant Name <span class="required">*</span></label>
            <input type="text" id="edit-name" name="name" class="form-input" value="${escapeHtml(r.name)}" required minlength="3" maxlength="100" />
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-desc">Description</label>
            <textarea id="edit-desc" name="description" class="form-textarea" maxlength="300">${escapeHtml(r.description || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-cuisines">Cuisine Types (comma separated) <span class="required">*</span></label>
            <input type="text" id="edit-cuisines" name="cuisineTypes" class="form-input" value="${escapeHtml(cuisines)}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-street">Street Address <span class="required">*</span></label>
            <input type="text" id="edit-street" name="street" class="form-input" value="${escapeHtml(addr.street || '')}" required minlength="3" maxlength="150" />
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="edit-city">City <span class="required">*</span></label>
              <input type="text" id="edit-city" name="city" class="form-input" value="${escapeHtml(addr.city || '')}" required minlength="2" maxlength="60" />
            </div>
            <div class="form-group">
              <label class="form-label" for="edit-pincode">Pincode (6 digits) <span class="required">*</span></label>
              <input type="text" id="edit-pincode" name="pincode" class="form-input" value="${escapeHtml(addr.pincode || '')}" required pattern="[1-9][0-9]{5}" maxlength="6" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="edit-phone">Phone Number <span class="required">*</span></label>
              <input type="tel" id="edit-phone" name="phone" class="form-input" value="${escapeHtml(r.phone || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="edit-img">Banner Image URL</label>
              <input type="url" id="edit-img" name="imageUrl" class="form-input" value="${escapeHtml(r.imageUrl || '')}" placeholder="https://images.unsplash.com/..." />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary" id="btn-save-profile">
              Save Profile Changes
            </button>
          </div>
        </form>

        <!-- Theme Preference Settings Card -->
        <div class="settings-section-card">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Appearance Theme</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">
            Choose between Gold Leaf Ivory (Light), Obsidian Charcoal (Dark), or sync with your system preference.
          </p>

          <div class="theme-options-grid" role="group" aria-label="Theme Selection">
            <button type="button" class="theme-option-btn ${savedTheme === 'light' ? 'active' : ''}" data-theme-val="light">
              <span style="font-size: 1.25rem;">☀️</span>
              <span>Light Mode</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Warm Ivory</span>
            </button>

            <button type="button" class="theme-option-btn ${savedTheme === 'dark' ? 'active' : ''}" data-theme-val="dark">
              <span style="font-size: 1.25rem;">🌙</span>
              <span>Dark Mode</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Obsidian Gold</span>
            </button>

            <button type="button" class="theme-option-btn ${savedTheme === 'system' ? 'active' : ''}" data-theme-val="system">
              <span style="font-size: 1.25rem;">🖥️</span>
              <span>System Default</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Follow OS</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('restaurant-edit-form')?.addEventListener('submit', (e) => this.handleUpdate(e));
    document.getElementById('btn-toggle-store-status')?.addEventListener('click', () => this.toggleOpenStatus());

    // Theme selector listeners
    container.querySelectorAll('.theme-option-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const themeVal = e.currentTarget.dataset.themeVal;
        if (themeVal) {
          setTheme(themeVal);
          container.querySelectorAll('.theme-option-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.themeVal === themeVal);
          });
          showToast(`Theme changed to ${themeVal} mode`, 'info');
        }
      });
    });

    // Synchronize profile theme buttons with global theme changes (e.g. from header toggle)
    window.addEventListener('zaykaa:theme-change', () => {
      const currentPref = getSavedTheme();
      container.querySelectorAll('.theme-option-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.themeVal === currentPref);
      });
    });
  }

  /**
   * Handles restaurant creation.
   *
   * @param {Event} e
   */
  async handleCreate(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const cuisineTypes = form.elements['cuisineTypes'].value
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const desc = form.elements['description'].value.trim();
    const rawImageUrl = form.elements['imageUrl'].value.trim();

    const payload = {
      name: form.elements['name'].value.trim(),
      ...(desc ? { description: desc } : {}),
      cuisineTypes,
      address: {
        street: form.elements['street'].value.trim(),
        city: form.elements['city'].value.trim(),
        pincode: form.elements['pincode'].value.trim(),
      },
      phone: form.elements['phone'].value.trim(),
      ...(rawImageUrl ? { imageUrl: rawImageUrl } : {}),
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Creating...`;
    }

    try {
      const created = await api.post('/api/restaurants', payload);
      showToast('Restaurant profile created successfully!', 'success');
      this.restaurant = created;
      this.render();
      if (typeof this.onRestaurantLoaded === 'function') {
        this.onRestaurantLoaded(this.restaurant);
      }
    } catch (err) {
      showToast(err.message || 'Failed to create restaurant profile', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Restaurant Profile';
      }
    }
  }

  /**
   * Handles restaurant profile updates.
   *
   * @param {Event} e
   */
  async handleUpdate(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('btn-save-profile');

    const cuisineTypes = form.elements['cuisineTypes'].value
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const desc = form.elements['description'].value.trim();
    const rawImageUrl = form.elements['imageUrl'].value.trim();

    const payload = {
      name: form.elements['name'].value.trim(),
      description: desc,
      cuisineTypes,
      address: {
        street: form.elements['street'].value.trim(),
        city: form.elements['city'].value.trim(),
        pincode: form.elements['pincode'].value.trim(),
      },
      phone: form.elements['phone'].value.trim(),
      imageUrl: rawImageUrl,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;
    }

    try {
      const updated = await api.put('/api/restaurants/mine', payload);
      showToast('Restaurant profile updated successfully!', 'success');
      this.restaurant = updated;
      this.render();
      if (typeof this.onRestaurantLoaded === 'function') {
        this.onRestaurantLoaded(this.restaurant);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update restaurant profile', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Profile Changes';
      }
    }
  }

  /**
   * Toggles the restaurant isOpen operational status.
   */
  async toggleOpenStatus() {
    if (!this.restaurant) return;
    const currentStatus = this.restaurant.isOpen !== false;
    const nextStatus = !currentStatus;

    try {
      const updated = await api.put('/api/restaurants/mine', {
        isOpen: nextStatus,
      });
      this.restaurant = updated;
      showToast(
        nextStatus ? 'Kitchen is now OPEN for customer orders' : 'Kitchen is now CLOSED',
        'info'
      );
      this.render();
      if (typeof this.onRestaurantLoaded === 'function') {
        this.onRestaurantLoaded(this.restaurant);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update kitchen status', 'error');
    }
  }
}
