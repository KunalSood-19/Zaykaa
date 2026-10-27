import api from '../../shared/js/api.js';
import { formatDateTime, escapeHtml, showToast } from '../../shared/js/utils.js';
import { getSavedTheme, setTheme, getActiveTheme } from '../../shared/js/theme.js';

export const VEHICLE_TYPES = ['Motorcycle', 'Scooter', 'Bicycle', 'Electric Vehicle'];

export class ProfileManager {
  /**
   * @param {(partner: object|null) => void} onPartnerLoadedFn
   */
  constructor(onPartnerLoadedFn) {
    this.onPartnerLoaded = onPartnerLoadedFn;
    this.partner = null;
  }

  /**
   * Loads the delivery partner profile from backend.
   * Handles HTTP 404 gracefully by rendering onboarding view.
   *
   * @returns {Promise<object|null>}
   */
  async loadProfile() {
    try {
      const partner = await api.get('/api/partners/me');
      this.partner = partner;
      this.render();

      if (typeof this.onPartnerLoaded === 'function') {
        this.onPartnerLoaded(this.partner);
      }
      return this.partner;
    } catch (err) {
      if (err.status === 404) {
        this.partner = null;
        this.renderOnboarding();
        if (typeof this.onPartnerLoaded === 'function') {
          this.onPartnerLoaded(null);
        }
        return null;
      }
      showToast(err.message || 'Failed to load delivery partner profile', 'error');
      return null;
    }
  }

  /**
   * Renders courier onboarding setup when no profile exists yet.
   */
  renderOnboarding() {
    const container = document.getElementById('profile-container');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width: 580px; margin: 0 auto; background-color: var(--bg-card); border: 1px solid var(--border-gold); border-radius: var(--radius-lg); padding: 2.5rem 2rem; box-shadow: var(--shadow-lg);">
        <div style="text-align: center; margin-bottom: 2rem;">
          <div style="font-size: 3.5rem; line-height: 1; margin-bottom: 0.75rem;">🌿 🛵</div>
          <div class="badge badge-gold-leaf" style="margin-bottom: 0.5rem;">Zaykaa Gold Leaf Delivery Fleet</div>
          <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem;">Join Zaykaa Courier Network</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            Complete your courier profile to start receiving order deliveries and servicing local restaurants.
          </p>
        </div>

        <form id="partner-onboarding-form">
          <div class="form-group">
            <label class="form-label" for="onboard-vehicle">Select Your Delivery Vehicle <span class="required">*</span></label>
            <select id="onboard-vehicle" name="vehicleType" class="form-select" required>
              ${VEHICLE_TYPES.map((v) => `<option value="${v}">${v}</option>`).join('')}
            </select>
            <span class="form-hint">Vehicle classification determines delivery dispatch eligibility</span>
          </div>

          <div style="background-color: var(--bg-surface); border-radius: var(--radius-md); padding: 1rem; margin: 1.5rem 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; border-left: 3px solid var(--brand-primary);">
            ℹ️ <strong>Courier Note:</strong> Your account starts in an <em>Offline</em> status by default. Once registered, switch duty to Online in the top header whenever you are ready to accept orders.
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.85rem; font-size: 1rem;">
            Register as Delivery Partner
          </button>
        </form>
      </div>
    `;

    document.getElementById('partner-onboarding-form')?.addEventListener('submit', (e) => this.handleCreate(e));
  }

  /**
   * Renders the partner profile and settings.
   */
  render() {
    const container = document.getElementById('profile-container');
    if (!container || !this.partner) return;

    const p = this.partner;
    const isOnline = p.isAvailable === true;
    const hasActiveOrder = Boolean(p.activeOrderId);
    const savedTheme = getSavedTheme();

    container.innerHTML = `
      <div style="max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        <!-- Profile Header Card -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-gold); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; box-shadow: var(--shadow-sm);">
          <div class="partner-avatar" style="width: 60px; height: 60px; font-size: 1.75rem;">
            🛵
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.5rem; font-weight: 800;">Fleet Partner</h2>
              <span class="badge ${isOnline ? 'badge-accepted' : 'badge-placed'}">
                ${isOnline ? 'Online for Duty' : 'Currently Offline'}
              </span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              Partner ID: <code style="font-family: var(--font-mono);">${escapeHtml(p.id)}</code> &bull;
              Joined ${formatDateTime(p.createdAt)}
            </div>
          </div>
        </div>

        <!-- Duty Availability Settings Card -->
        <div class="settings-section-card">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Duty Availability</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
            When Online, you can discover and claim orders in the Available Orders pool.
          </p>

          <div style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-surface); padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 700; color: var(--text-main);">Duty Status</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">
                ${hasActiveOrder
                  ? '🔒 Cannot switch availability while delivering an active order.'
                  : (isOnline ? 'You are receiving delivery requests.' : 'You are currently off duty.')}
              </div>
            </div>

            <label class="switch-label">
              <div class="switch">
                <input type="checkbox" id="profile-availability-toggle" ${isOnline ? 'checked' : ''} ${hasActiveOrder ? 'disabled' : ''} />
                <span class="switch-slider"></span>
              </div>
              <span style="font-weight: 700;">${isOnline ? 'Online' : 'Offline'}</span>
            </label>
          </div>
        </div>

        <!-- Vehicle Classification Settings Form -->
        <div class="settings-section-card">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Vehicle Settings</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
            Update your registered mode of transportation.
          </p>

          <form id="partner-update-form">
            <div class="form-group">
              <label class="form-label" for="edit-vehicle">Vehicle Type <span class="required">*</span></label>
              <select id="edit-vehicle" name="vehicleType" class="form-select" required>
                ${VEHICLE_TYPES.map((v) => `
                  <option value="${v}" ${v === p.vehicleType ? 'selected' : ''}>${v}</option>
                `).join('')}
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 1.25rem;">
              <button type="submit" class="btn btn-primary" id="btn-save-vehicle">
                Save Vehicle Changes
              </button>
            </div>
          </form>
        </div>

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

        <!-- Lifetime Performance Card -->
        <div class="settings-section-card">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Lifetime Record</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div style="background-color: var(--bg-surface); padding: 1.15rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Completed Drops</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: var(--status-delivered-text); margin-top: 0.25rem;">${p.totalDeliveries || 0}</div>
            </div>
            <div style="background-color: var(--bg-surface); padding: 1.15rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Active Order</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.25rem;">
                ${p.activeOrderId ? p.activeOrderId.slice(0, 16) + '...' : 'None (Idle)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Listeners
    document.getElementById('profile-availability-toggle')?.addEventListener('change', (e) => {
      this.toggleAvailability(e.target.checked);
    });

    document.getElementById('partner-update-form')?.addEventListener('submit', (e) => {
      this.handleUpdate(e);
    });

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
  }

  /**
   * Handles partner onboarding creation via POST /api/partners
   */
  async handleCreate(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const vehicleType = form.elements['vehicleType'].value;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Registering...`;
    }

    try {
      const created = await api.post('/api/partners', {
        vehicleType,
        isAvailable: false,
      });

      showToast('Delivery partner profile created! Welcome to Zaykaa.', 'success');
      this.partner = created;
      this.render();

      if (typeof this.onPartnerLoaded === 'function') {
        this.onPartnerLoaded(this.partner);
      }
    } catch (err) {
      showToast(err.message || 'Failed to create partner profile', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register as Delivery Partner';
      }
    }
  }

  /**
   * Updates vehicle type via PUT /api/partners/profile
   */
  async handleUpdate(e) {
    e.preventDefault();
    const form = e.target;
    const saveBtn = document.getElementById('btn-save-vehicle');
    const vehicleType = form.elements['vehicleType'].value;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner"></span> Saving...`;
    }

    try {
      const updated = await api.put('/api/partners/profile', {
        vehicleType,
      });

      showToast(`Vehicle updated to ${vehicleType}`, 'success');
      this.partner = updated;
      this.render();

      if (typeof this.onPartnerLoaded === 'function') {
        this.onPartnerLoaded(this.partner);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update vehicle', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Vehicle Changes';
      }
    }
  }

  /**
   * Toggles partner online/offline availability via PATCH /api/partners/availability
   *
   * @param {boolean} nextAvailable
   */
  async toggleAvailability(nextAvailable) {
    if (this.partner?.activeOrderId && nextAvailable === true) {
      showToast('Cannot go online while an active delivery is in progress', 'error');
      this.render();
      return;
    }

    try {
      const updated = await api.patch('/api/partners/availability', {
        isAvailable: nextAvailable,
      });

      this.partner = updated;
      showToast(`Duty status: ${nextAvailable ? 'Online' : 'Offline'}`, 'info');
      this.render();

      if (typeof this.onPartnerLoaded === 'function') {
        this.onPartnerLoaded(this.partner);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update availability', 'error');
      this.render();
    }
  }
}
