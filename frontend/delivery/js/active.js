import api from '../../shared/js/api.js';
import {
  formatPaise,
  formatDateTime,
  escapeHtml,
  showToast,
  getStatusBadgeClass,
} from '../../shared/js/utils.js';

export class ActiveDeliveryManager {
  /**
   * @param {() => object|null} getPartnerFn
   * @param {(completedOrder: object) => void} onDeliveryCompletedFn
   * @param {(viewId: string) => void} navigateFn
   */
  constructor(getPartnerFn, onDeliveryCompletedFn, navigateFn) {
    this.getPartner = getPartnerFn;
    this.onDeliveryCompleted = onDeliveryCompletedFn;
    this.navigate = navigateFn;
    this.activeOrder = null;
  }

  /**
   * Loads the current active order from backend.
   *
   * @returns {Promise<object|null>}
   */
  async loadActiveOrder() {
    const partner = this.getPartner();
    const container = document.getElementById('active-delivery-container');

    if (!partner) {
      this.activeOrder = null;
      this.render();
      return null;
    }

    try {
      const order = await api.get('/api/partners/orders/active');
      this.activeOrder = order || null;
      this.render();

      // Update active dot in navigation
      const dot = document.getElementById('nav-active-dot');
      if (dot) {
        dot.style.display = this.activeOrder ? 'inline-block' : 'none';
      }

      return this.activeOrder;
    } catch (err) {
      showToast(err.message || 'Failed to load active delivery', 'error');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">⚠️</span>
            <div class="empty-state-title">Error Loading Active Delivery</div>
            <div class="empty-state-desc">${escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" id="btn-retry-active">Try Again</button>
          </div>
        `;
        document.getElementById('btn-retry-active')?.addEventListener('click', () => this.loadActiveOrder());
      }
      return null;
    }
  }

  /**
   * Renders the active delivery order or idle state.
   */
  render() {
    const container = document.getElementById('active-delivery-container');
    if (!container) return;

    if (!this.activeOrder) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 3.5rem 1.5rem; border: 1px dashed var(--border-medium);">
          <span class="empty-state-icon">🛵</span>
          <div class="empty-state-title">No Active Delivery</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0 auto 1.5rem;">
            You do not have any delivery assigned right now. Browse available orders from nearby restaurants to claim your next package.
          </div>
          <button type="button" class="btn btn-primary" id="btn-browse-from-active">
            Browse Available Orders
          </button>
        </div>
      `;

      document.getElementById('btn-browse-from-active')?.addEventListener('click', () => {
        this.navigate('available');
      });
      return;
    }

    const order = this.activeOrder;
    const pickup = order.pickupAddress || {};
    const dropoff = order.deliveryAddress || {};
    const items = order.items || [];
    const fee = order.pricing?.deliveryFee || 0;

    // Determine Stepper Active Step
    const currentStatus = order.status;
    const isStep1 = ['Placed', 'Accepted', 'Preparing'].includes(currentStatus);
    const isStep2 = currentStatus === 'Ready for Pickup';
    const isStep3 = currentStatus === 'Picked Up';
    const isStep4 = currentStatus === 'Out for Delivery';

    // Action button configuration based on order lifecycle
    let actionButtonHtml = '';
    if (isStep1) {
      actionButtonHtml = `
        <button type="button" class="btn btn-action-large btn-secondary" disabled style="opacity: 0.7; cursor: not-allowed;">
          <span>⏳ Kitchen is Preparing Food...</span>
        </button>
        <p style="font-size: 0.82rem; color: var(--text-muted); text-align: center; margin-top: 0.5rem;">
          The restaurant will mark the order "Ready for Pickup" when packaged.
        </p>
      `;
    } else if (isStep2) {
      actionButtonHtml = `
        <button type="button" class="btn btn-action-large btn-primary" id="btn-action-pickup" data-id="${order.id}">
          <span>🛍️ Confirm Package Pickup</span>
        </button>
      `;
    } else if (isStep3) {
      actionButtonHtml = `
        <button type="button" class="btn btn-action-large btn-primary" id="btn-action-out" data-id="${order.id}">
          <span>🛵 Depart Restaurant &amp; Start Delivery</span>
        </button>
      `;
    } else if (isStep4) {
      actionButtonHtml = `
        <button type="button" class="btn btn-action-large btn-success" id="btn-action-deliver" data-id="${order.id}">
          <span>✅ Confirm Delivery Handover to Customer</span>
        </button>
      `;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <!-- Header Banner -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-gold); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; box-shadow: var(--shadow-sm);">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.04em;">Active Delivery Assignment</span>
            <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--text-main);">
              ${escapeHtml(order.id)}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              Assigned Order &bull; Placed: ${formatDateTime(order.timestamps?.createdAt || order.createdAt)}
            </div>
          </div>
          <span class="badge ${getStatusBadgeClass(order.status)}" style="font-size: 0.9rem; padding: 0.4rem 0.85rem;">
            ${escapeHtml(order.status)}
          </span>
        </div>

        <!-- 4-Step Progress Stepper -->
        <div class="delivery-stepper" aria-label="Order Progress">
          <div class="step-item ${isStep1 ? 'active' : 'completed'}">
            <div class="step-circle">${isStep1 ? '1' : '✓'}</div>
            <span class="step-label">1. Kitchen Prep</span>
          </div>

          <div class="step-item ${isStep2 ? 'active' : (isStep3 || isStep4 ? 'completed' : '')}">
            <div class="step-circle">${isStep2 ? '2' : (isStep3 || isStep4 ? '✓' : '2')}</div>
            <span class="step-label">2. Ready Pickup</span>
          </div>

          <div class="step-item ${isStep3 ? 'active' : (isStep4 ? 'completed' : '')}">
            <div class="step-circle">${isStep3 ? '3' : (isStep4 ? '✓' : '3')}</div>
            <span class="step-label">3. Picked Up</span>
          </div>

          <div class="step-item ${isStep4 ? 'active' : ''}">
            <div class="step-circle">4</div>
            <span class="step-label">4. Out for Delivery</span>
          </div>
        </div>

        <!-- Action Button Box (Prominent for Rider) -->
        <div class="action-card-wrapper">
          ${actionButtonHtml}
        </div>

        <!-- Route & Details Cards -->
        <div class="route-grid">
          <!-- Restaurant Pickup Card -->
          <div class="route-card" style="border-left: 4px solid var(--brand-primary);">
            <span class="route-card-tag pickup">🏬 1. Pickup From</span>
            <div class="route-title">${escapeHtml(order.restaurantName || 'Restaurant')}</div>
            <div class="route-address">
              ${escapeHtml(pickup.street || '')}, ${escapeHtml(pickup.city || '')} — ${escapeHtml(pickup.pincode || '')}
            </div>
            ${order.restaurantPhone ? `
              <div class="route-contact">
                <a href="tel:${escapeHtml(order.restaurantPhone)}" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.4rem;">
                  <span>📞 Call Restaurant (${escapeHtml(order.restaurantPhone)})</span>
                </a>
              </div>
            ` : ''}
          </div>

          <!-- Customer Dropoff Card -->
          <div class="route-card" style="border-left: 4px solid var(--olive-primary);">
            <span class="route-card-tag dropoff" style="color: var(--olive-primary);">📍 2. Deliver To</span>
            <div class="route-title">${escapeHtml(order.customerName || 'Customer')}</div>
            <div class="route-address">
              ${escapeHtml(dropoff.street || '')}, ${escapeHtml(dropoff.city || '')} — ${escapeHtml(dropoff.pincode || '')}
            </div>
            ${order.customerPhone ? `
              <div class="route-contact">
                <a href="tel:${escapeHtml(order.customerPhone)}" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.4rem;">
                  <span>📞 Call Customer (${escapeHtml(order.customerPhone)})</span>
                </a>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Order Items & Bill Breakdown -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm);">
          <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; letter-spacing: 0.04em;">
            Package Items (${items.length})
          </h4>
          <ul class="order-items-snippet" style="margin-bottom: 1rem;">
            ${items.map((i) => `
              <li class="order-item-row">
                <span>${escapeHtml(i.name)} &times; ${i.quantity}</span>
                <span style="font-weight: 600;">${formatPaise((i.price || 0) * i.quantity)}</span>
              </li>
            `).join('')}
          </ul>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.85rem;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Order Delivery Fee</span>
            <span style="font-size: 1.35rem; font-weight: 800; color: var(--status-delivered-text);">${formatPaise(fee)}</span>
          </div>
        </div>
      </div>
    `;

    // Attach Action Listeners
    document.getElementById('btn-action-pickup')?.addEventListener('click', (e) => {
      this.handlePickup(e.currentTarget.dataset.id, e.currentTarget);
    });

    document.getElementById('btn-action-out')?.addEventListener('click', (e) => {
      this.handleOutForDelivery(e.currentTarget.dataset.id, e.currentTarget);
    });

    document.getElementById('btn-action-deliver')?.addEventListener('click', (e) => {
      this.handleDeliver(e.currentTarget.dataset.id, e.currentTarget);
    });
  }

  /**
   * Confirms pickup from restaurant via PATCH /api/partners/orders/:id/pickup
   */
  async handlePickup(orderId, buttonEl) {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="spinner"></span> Confirming Pickup...`;
    }

    try {
      const updated = await api.patch(`/api/partners/orders/${orderId}/pickup`);
      showToast('Package picked up! Ready to depart.', 'success');
      this.activeOrder = {
        ...this.activeOrder,
        ...updated,
      };
      this.render();
    } catch (err) {
      showToast(err.message || 'Failed to confirm pickup', 'error');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<span>🛍️ Confirm Package Pickup</span>`;
      }
    }
  }

  /**
   * Marks order Out for Delivery via PATCH /api/partners/orders/:id/out-for-delivery
   */
  async handleOutForDelivery(orderId, buttonEl) {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="spinner"></span> Starting Delivery Route...`;
    }

    try {
      const updated = await api.patch(`/api/partners/orders/${orderId}/out-for-delivery`);
      showToast('Out for delivery! Navigate safely to the customer.', 'success');
      this.activeOrder = {
        ...this.activeOrder,
        ...updated,
      };
      this.render();
    } catch (err) {
      showToast(err.message || 'Failed to update delivery status', 'error');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<span>🛵 Depart Restaurant &amp; Start Delivery</span>`;
      }
    }
  }

  /**
   * Confirms final delivery handover via PATCH /api/partners/orders/:id/deliver
   */
  async handleDeliver(orderId, buttonEl) {
    if (!confirm('Confirm customer handover? This completes the order and logs the delivery.')) {
      return;
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="spinner"></span> Completing Delivery...`;
    }

    try {
      const delivered = await api.patch(`/api/partners/orders/${orderId}/deliver`);
      showToast('Delivery completed successfully! Great job.', 'success');

      const completed = {
        ...this.activeOrder,
        ...delivered,
      };

      this.activeOrder = null;
      this.render();

      if (typeof this.onDeliveryCompleted === 'function') {
        this.onDeliveryCompleted(completed);
      }
    } catch (err) {
      showToast(err.message || 'Failed to complete delivery', 'error');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<span>✅ Confirm Delivery Handover to Customer</span>`;
      }
    }
  }
}
