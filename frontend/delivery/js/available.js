import api from '../../shared/js/api.js';
import {
  formatPaise,
  formatDateTime,
  timeAgo,
  escapeHtml,
  showToast,
  getStatusBadgeClass,
} from '../../shared/js/utils.js';

export class AvailableOrdersManager {
  /**
   * @param {() => object|null} getPartnerFn
   * @param {(order: object) => void} onOrderClaimedFn
   * @param {(viewId: string) => void} navigateFn
   */
  constructor(getPartnerFn, onOrderClaimedFn, navigateFn) {
    this.getPartner = getPartnerFn;
    this.onOrderClaimed = onOrderClaimedFn;
    this.navigate = navigateFn;
    this.orders = [];

    this.bindEvents();
  }

  bindEvents() {
    const btnRefresh = document.getElementById('btn-refresh-available');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadAvailableOrders(true));
    }

    // Modal close handlers
    const modal = document.getElementById('delivery-detail-modal');
    if (modal) {
      modal.querySelectorAll('.modal-close').forEach((btn) => {
        btn.addEventListener('click', () => modal.classList.remove('active'));
      });
    }
  }

  /**
   * Fetches available delivery orders pool from backend.
   *
   * @param {boolean} [showToastFeedback=false]
   * @returns {Promise<Array<object>>}
   */
  async loadAvailableOrders(showToastFeedback = false) {
    const partner = this.getPartner();
    const container = document.getElementById('available-orders-container');

    if (!partner) {
      this.orders = [];
      this.render();
      return [];
    }

    try {
      const orders = await api.get('/api/partners/orders/available');
      this.orders = Array.isArray(orders) ? orders : [];
      this.render();

      // Update badge in sidebar and mobile nav
      const badgeEl = document.getElementById('nav-available-count');
      const mobileBadgeEl = document.getElementById('mobile-available-badge');
      const count = this.orders.length;

      if (badgeEl) {
        badgeEl.textContent = String(count);
        badgeEl.style.display = count > 0 ? 'inline-block' : 'none';
      }
      if (mobileBadgeEl) {
        mobileBadgeEl.textContent = String(count);
        mobileBadgeEl.style.display = count > 0 ? 'inline-block' : 'none';
      }

      if (showToastFeedback) {
        showToast(`Available orders refreshed (${count} found)`, 'info');
      }

      return this.orders;
    } catch (err) {
      if (showToastFeedback) {
        showToast(err.message || 'Failed to fetch available orders', 'error');
      }
      if (container && !this.orders.length) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">⚠️</span>
            <div class="empty-state-title">Unable to Load Orders</div>
            <div class="empty-state-desc">${escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" id="btn-retry-available">Try Again</button>
          </div>
        `;
        document.getElementById('btn-retry-available')?.addEventListener('click', () => this.loadAvailableOrders(true));
      }
      return [];
    }
  }

  /**
   * Renders the available orders list or relevant status messages.
   */
  render() {
    const container = document.getElementById('available-orders-container');
    if (!container) return;

    const partner = this.getPartner();

    // Case 1: Partner is offline
    if (!partner?.isAvailable) {
      container.innerHTML = `
        <div class="empty-state" style="border: 1px dashed var(--border-medium); padding: 3rem 1.5rem;">
          <span class="empty-state-icon">💤</span>
          <div class="empty-state-title">You Are Currently Offline</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0 auto 1.5rem;">
            Switch your duty status to Online in the top header or click below to start receiving orders from local restaurants.
          </div>
          <button type="button" class="btn btn-primary" id="btn-go-online-from-available">
            Go Online Now
          </button>
        </div>
      `;

      document.getElementById('btn-go-online-from-available')?.addEventListener('click', () => {
        document.getElementById('duty-toggle')?.click();
      });
      return;
    }

    // Case 2: Partner has an active order
    if (partner?.activeOrderId) {
      container.innerHTML = `
        <div class="empty-state" style="border: 1px solid var(--border-gold); background-color: var(--brand-light); padding: 3rem 1.5rem;">
          <span class="empty-state-icon">🛵</span>
          <div class="empty-state-title">Active Delivery In Progress</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0 auto 1.5rem;">
            You are currently assigned to order <code style="font-family: var(--font-mono); font-weight: 700;">${escapeHtml(partner.activeOrderId.slice(0, 16))}...</code>. Complete your active delivery before accepting new orders.
          </div>
          <button type="button" class="btn btn-primary" id="btn-view-active-from-available">
            Go to Active Delivery
          </button>
        </div>
      `;

      document.getElementById('btn-view-active-from-available')?.addEventListener('click', () => {
        this.navigate('active');
      });
      return;
    }

    // Case 3: Online and idle, but 0 orders in pool
    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1.5rem;">
          <span class="empty-state-icon">⏳</span>
          <div class="empty-state-title">No Available Orders Right Now</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0 auto 1.5rem;">
            You are online and ready! As soon as customers place orders and restaurants begin preparing, they will appear here automatically.
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-recheck-available" style="margin-top: 1rem;">
            ↻ Check Again
          </button>
        </div>
      `;

      document.getElementById('btn-recheck-available')?.addEventListener('click', () => this.loadAvailableOrders(true));
      return;
    }

    // Case 4: Orders available to claim
    container.innerHTML = `
      <div class="orders-list-grid">
        ${this.orders.map((order) => {
          const pickupAddr = order.pickupAddress || {};
          const dropoffAddr = order.deliveryAddress || {};
          const itemsCount = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
          const fee = order.pricing?.deliveryFee || 0;

          return `
            <article class="delivery-order-card" data-order-id="${order.id}">
              <div class="delivery-card-top">
                <div>
                  <span class="order-code">${escapeHtml(order.id.slice(0, 16))}...</span>
                  <div class="order-timing">${timeAgo(order.createdAt)} &bull; ${formatDateTime(order.createdAt)}</div>
                </div>
                <span class="badge ${getStatusBadgeClass(order.status)}">
                  ${escapeHtml(order.status)}
                </span>
              </div>

              <div class="route-steps-compact">
                <!-- Pickup Point -->
                <div class="step-row">
                  <span class="step-row-icon" title="Restaurant Pickup">🏬</span>
                  <div class="step-row-text">
                    <div class="step-row-name">${escapeHtml(order.restaurantName || 'Restaurant')}</div>
                    <div class="step-row-sub">${escapeHtml(pickupAddr.street || '')}, ${escapeHtml(pickupAddr.city || '')}</div>
                  </div>
                </div>

                <!-- Dropoff Point -->
                <div class="step-row">
                  <span class="step-row-icon" title="Delivery Destination">📍</span>
                  <div class="step-row-text">
                    <div class="step-row-name">Customer Drop-off</div>
                    <div class="step-row-sub">${escapeHtml(dropoffAddr.street || '')}, ${escapeHtml(dropoffAddr.city || '')}</div>
                  </div>
                </div>

                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                  🍱 ${itemsCount} items &bull; Total Value: ${formatPaise(order.pricing?.total || 0)}
                </div>
              </div>

              <div class="delivery-card-bottom">
                <div class="order-fee-badge">
                  <span class="fee-label">Delivery Fee</span>
                  <span class="fee-amount">${formatPaise(fee)}</span>
                </div>

                <div style="display: flex; gap: 0.5rem;">
                  <button type="button" class="btn btn-secondary btn-sm btn-order-info" data-id="${order.id}">
                    Details
                  </button>
                  <button type="button" class="btn btn-primary btn-sm btn-claim-order" data-id="${order.id}">
                    Accept Delivery
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    // Attach listeners
    container.querySelectorAll('.btn-order-info').forEach((btn) => {
      btn.addEventListener('click', (e) => this.showOrderDetails(e.currentTarget.dataset.id));
    });

    container.querySelectorAll('.btn-claim-order').forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleClaimOrder(e.currentTarget.dataset.id, e.currentTarget));
    });
  }

  /**
   * Accepts and claims an order via PATCH /api/partners/orders/:id/accept
   *
   * @param {string} orderId
   * @param {HTMLButtonElement} buttonEl
   */
  async handleClaimOrder(orderId, buttonEl) {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="spinner"></span> Accepting...`;
    }

    try {
      const acceptedOrder = await api.patch(`/api/partners/orders/${orderId}/accept`);
      showToast('Delivery order accepted! Navigate to Active Delivery to proceed.', 'success');

      if (typeof this.onOrderClaimed === 'function') {
        this.onOrderClaimed(acceptedOrder);
      }
    } catch (err) {
      if (err.status === 409) {
        showToast('This order was just claimed by another courier. Refreshing available pool...', 'error');
        await this.loadAvailableOrders();
      } else if (err.code === 'PARTNER_UNAVAILABLE') {
        showToast('You must be Online to accept orders. Turn on duty first.', 'error');
      } else if (err.code === 'ACTIVE_ORDER_RESTRICTION') {
        showToast('You cannot accept an order while an active delivery is in progress.', 'error');
      } else {
        showToast(err.message || 'Failed to accept order', 'error');
      }

      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = 'Accept Delivery';
      }
    }
  }

  /**
   * Opens detail modal showing complete order information.
   *
   * @param {string} orderId
   */
  showOrderDetails(orderId) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('delivery-detail-modal');
    const content = document.getElementById('delivery-detail-content');
    if (!modal || !content) return;

    const pickup = order.pickupAddress || {};
    const dropoff = order.deliveryAddress || {};
    const items = order.items || [];

    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
          <div>
            <div style="font-family: var(--font-mono); font-weight: 700; font-size: 1.05rem; color: var(--text-main);">${escapeHtml(order.id)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${formatDateTime(order.createdAt)}</div>
          </div>
          <span class="badge ${getStatusBadgeClass(order.status)}">${escapeHtml(order.status)}</span>
        </div>

        <div class="route-grid">
          <div class="route-card" style="border-left: 3px solid var(--brand-primary);">
            <span class="route-card-tag pickup">🏬 Pickup Location</span>
            <div class="route-title">${escapeHtml(order.restaurantName || 'Restaurant')}</div>
            <div class="route-address">${escapeHtml(pickup.street || '')}, ${escapeHtml(pickup.city || '')} ${escapeHtml(pickup.pincode || '')}</div>
            ${order.restaurantPhone ? `<div class="route-contact">📞 <a href="tel:${escapeHtml(order.restaurantPhone)}" style="color: inherit;">${escapeHtml(order.restaurantPhone)}</a></div>` : ''}
          </div>

          <div class="route-card" style="border-left: 3px solid var(--olive-primary);">
            <span class="route-card-tag dropoff" style="color: var(--olive-primary);">📍 Drop-off Destination</span>
            <div class="route-title">Customer Destination</div>
            <div class="route-address">${escapeHtml(dropoff.street || '')}, ${escapeHtml(dropoff.city || '')} — ${escapeHtml(dropoff.pincode || '')}</div>
          </div>
        </div>

        <div>
          <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.04em;">Ordered Dishes (${items.length})</h4>
          <ul class="order-items-snippet" style="background-color: var(--bg-surface); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            ${items.map((i) => `
              <li class="order-item-row">
                <span>${escapeHtml(i.name)} &times; ${i.quantity}</span>
                <span style="font-weight: 600;">${formatPaise((i.price || 0) * i.quantity)}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Delivery Fee</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--status-delivered-text);">${formatPaise(order.pricing?.deliveryFee || 0)}</div>
          </div>
          <button type="button" class="btn btn-primary" id="btn-modal-claim" data-id="${order.id}">
            Accept Delivery
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-modal-claim')?.addEventListener('click', (e) => {
      modal.classList.remove('active');
      const btnInGrid = document.querySelector(`.btn-claim-order[data-id="${e.currentTarget.dataset.id}"]`);
      this.handleClaimOrder(e.currentTarget.dataset.id, btnInGrid);
    });

    modal.classList.add('active');
  }
}
