import api from '../../shared/js/api.js';
import {
  formatPaise,
  formatDateTime,
  timeAgo,
  getStatusBadgeClass,
  escapeHtml,
  showToast,
} from '../../shared/js/utils.js';

export class OrderManager {
  /**
   * @param {() => object|null} getRestaurantFn
   * @param {(orders: Array<object>) => void} onOrdersLoadedFn
   */
  constructor(getRestaurantFn, onOrdersLoadedFn) {
    this.getRestaurant = getRestaurantFn;
    this.onOrdersLoaded = onOrdersLoadedFn;
    this.orders = [];
    this.selectedFilter = 'All';
    this.activeModalOrderId = null;

    this.bindEvents();
  }

  bindEvents() {
    // Status filter tabs
    const statusTabs = document.querySelectorAll('.order-status-tab');
    statusTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        statusTabs.forEach((t) => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedFilter = e.currentTarget.dataset.status || 'All';
        this.render();
      });
    });

    // Refresh orders button
    const btnRefresh = document.getElementById('btn-refresh-orders');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.loadOrders(true);
      });
    }

    // Order detail modal close
    const modalCloseButtons = document.querySelectorAll('#order-detail-modal .modal-close, #order-detail-modal .btn-cancel');
    modalCloseButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.closeDetailModal());
    });
  }

  /**
   * Loads incoming orders for the restaurant from backend.
   *
   * @param {boolean} [showFeedback=false]
   */
  async loadOrders(showFeedback = false) {
    const restaurant = this.getRestaurant();
    if (!restaurant?.id) {
      this.orders = [];
      this.render();
      return;
    }

    const container = document.getElementById('orders-container');
    if (!this.orders.length && container) {
      container.innerHTML = `
        <div class="loading-block">
          <span class="spinner"></span>
          <span>Loading incoming orders queue...</span>
        </div>
      `;
    }

    try {
      const orders = await api.get(`/api/orders/restaurant/${restaurant.id}`);
      this.orders = Array.isArray(orders) ? orders : [];
      this.render();
      if (typeof this.onOrdersLoaded === 'function') {
        this.onOrdersLoaded(this.orders);
      }
      if (showFeedback) {
        showToast('Orders queue refreshed', 'info');
      }
    } catch (err) {
      if (showFeedback) {
        showToast(err.message || 'Failed to refresh orders', 'error');
      }
      if (container && !this.orders.length) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">⚠️</span>
            <div class="empty-state-title">Unable to load orders</div>
            <div class="empty-state-desc">${escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" id="btn-retry-orders">Retry</button>
          </div>
        `;
        document.getElementById('btn-retry-orders')?.addEventListener('click', () => this.loadOrders(true));
      }
    }
  }

  /**
   * Filters and renders order cards.
   */
  render() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    let filtered = this.orders;

    if (this.selectedFilter === 'New') {
      filtered = filtered.filter((o) => o.status === 'Placed');
    } else if (this.selectedFilter === 'Accepted') {
      filtered = filtered.filter((o) => o.status === 'Accepted');
    } else if (this.selectedFilter === 'Kitchen') {
      filtered = filtered.filter((o) => o.status === 'Preparing');
    } else if (this.selectedFilter === 'Ready') {
      filtered = filtered.filter((o) => o.status === 'Ready for Pickup');
    } else if (this.selectedFilter === 'InTransit') {
      filtered = filtered.filter((o) => o.status === 'Picked Up' || o.status === 'Out for Delivery');
    } else if (this.selectedFilter === 'Delivered') {
      filtered = filtered.filter((o) => o.status === 'Delivered');
    } else if (this.selectedFilter === 'Cancelled') {
      filtered = filtered.filter((o) => o.status === 'Cancelled' || o.status === 'Rejected');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-state-icon">📦</span>
          <div class="empty-state-title">No orders in this view</div>
          <div class="empty-state-desc">
            ${this.selectedFilter === 'All'
              ? 'Incoming customer orders will appear here automatically.'
              : `There are currently no orders with status '${this.selectedFilter}'.`}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((order) => {
      const items = order.items || [];
      const itemsListHtml = items.slice(0, 3).map((item) => `
        <li class="order-item-row">
          <span>${escapeHtml(item.name)} &times; ${item.quantity}</span>
          <span>${formatPaise((item.price || 0) * item.quantity)}</span>
        </li>
      `).join('');

      const moreItems = items.length > 3 ? `<li style="font-size: 0.8rem; color: var(--text-muted);">+ ${items.length - 3} more items</li>` : '';

      // Delivery partner assignment badge
      let deliverySnippet = `<span style="color: var(--text-muted);">Delivery: Awaiting claim</span>`;
      if (order.deliveryPartnerId) {
        deliverySnippet = `<span style="color: var(--status-ready-text); font-weight: 600;">Delivery: Courier Assigned</span>`;
      }

      // Action buttons based on status
      const actionButtons = this.renderActionButtons(order);

      return `
        <article class="order-card" data-order-id="${order.id}">
          <div class="order-card-header">
            <div>
              <span class="order-id-label">${escapeHtml(order.id.slice(0, 14))}...</span>
              <div class="order-time">${timeAgo(order.timestamps?.createdAt || order.createdAt)} &bull; ${formatDateTime(order.timestamps?.createdAt || order.createdAt)}</div>
            </div>
            <span class="badge ${getStatusBadgeClass(order.status)}">
              <span class="badge-dot"></span>
              ${escapeHtml(order.status)}
            </span>
          </div>

          <div class="order-customer-info">
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(order.customerName || 'Customer')}</div>
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${escapeHtml(order.deliveryAddress?.street || '')}, ${escapeHtml(order.deliveryAddress?.city || '')}</div>
            <div>${deliverySnippet}</div>
          </div>

          <ul class="order-items-snippet">
            ${itemsListHtml}
            ${moreItems}
          </ul>

          <div class="order-card-footer">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Bill</div>
              <div class="order-total-price">${formatPaise(order.pricing?.total || 0)}</div>
            </div>
            <div class="order-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-view-order" data-id="${order.id}">Details</button>
              ${actionButtons}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.btn-view-order').forEach((btn) => {
      btn.addEventListener('click', (e) => this.openDetailModal(e.currentTarget.dataset.id));
    });

    container.querySelectorAll('.btn-order-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.id;
        const targetStatus = e.currentTarget.dataset.targetStatus;
        this.updateOrderStatus(orderId, targetStatus);
      });
    });
  }

  /**
   * Generates context-appropriate action buttons for restaurant orders.
   *
   * @param {object} order
   * @returns {string} HTML string
   */
  renderActionButtons(order) {
    switch (order.status) {
      case 'Placed':
        return `
          <button type="button" class="btn btn-success btn-sm btn-order-action" data-id="${order.id}" data-target-status="Accepted">
            Accept
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-order-action" data-id="${order.id}" data-target-status="Rejected">
            Reject
          </button>
        `;
      case 'Accepted':
        return `
          <button type="button" class="btn btn-primary btn-sm btn-order-action" data-id="${order.id}" data-target-status="Preparing">
            Start Cooking
          </button>
        `;
      case 'Preparing':
        return `
          <button type="button" class="btn btn-primary btn-sm btn-order-action" data-id="${order.id}" data-target-status="Ready for Pickup">
            Mark Ready
          </button>
        `;
      case 'Ready for Pickup':
        return `
          <span style="font-size: 0.8rem; color: var(--status-ready-text); align-self: center; font-weight: 600;">
            Awaiting Courier
          </span>
        `;
      case 'Picked Up':
      case 'Out for Delivery':
        return `
          <span style="font-size: 0.8rem; color: var(--status-transit-text); align-self: center; font-weight: 600;">
            In Transit
          </span>
        `;
      case 'Delivered':
        return `
          <span style="font-size: 0.8rem; color: var(--status-delivered-text); align-self: center; font-weight: 600;">
            Completed
          </span>
        `;
      case 'Rejected':
      case 'Cancelled':
        return `
          <span style="font-size: 0.8rem; color: var(--status-cancelled-text); align-self: center; font-weight: 600;">
            ${order.status}
          </span>
        `;
      default:
        return '';
    }
  }

  /**
   * Executes status transition via PATCH /api/orders/:id/status
   *
   * @param {string} orderId
   * @param {string} targetStatus
   */
  async updateOrderStatus(orderId, targetStatus) {
    if (targetStatus === 'Rejected') {
      if (!confirm('Are you sure you want to decline and reject this order? This action is permanent.')) {
        return;
      }
    }

    try {
      const updated = await api.patch(`/api/orders/${orderId}/status`, {
        status: targetStatus,
      });

      showToast(`Order status updated to '${targetStatus}'`, 'success');

      // Update local array
      const idx = this.orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        this.orders[idx] = updated;
      }

      this.render();

      if (typeof this.onOrdersLoaded === 'function') {
        this.onOrdersLoaded(this.orders);
      }

      // If details modal is open for this order, refresh modal
      if (this.activeModalOrderId === orderId) {
        this.openDetailModal(orderId);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update order status', 'error');
    }
  }

  /**
   * Opens the full order details modal.
   *
   * @param {string} orderId
   */
  async openDetailModal(orderId) {
    this.activeModalOrderId = orderId;
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('order-detail-content');
    if (!modal || !content) return;

    modal.classList.add('active');
    content.innerHTML = `
      <div class="loading-block">
        <span class="spinner"></span>
        <span>Loading full order details...</span>
      </div>
    `;

    try {
      const order = await api.get(`/api/orders/${orderId}`);
      this.renderDetailModalContent(order);
    } catch (err) {
      content.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">⚠️</span>
          <div class="empty-state-title">Error Loading Order</div>
          <div class="empty-state-desc">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  closeDetailModal() {
    const modal = document.getElementById('order-detail-modal');
    if (modal) modal.classList.remove('active');
    this.activeModalOrderId = null;
  }

  /**
   * Populates the order details modal with complete breakdown.
   *
   * @param {object} order
   */
  renderDetailModalContent(order) {
    const content = document.getElementById('order-detail-content');
    if (!content) return;

    const itemsRows = (order.items || []).map((item) => `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="padding: 0.65rem 0; font-weight: 600;">${escapeHtml(item.name)}</td>
        <td style="padding: 0.65rem 0; text-align: center;">&times; ${item.quantity}</td>
        <td style="padding: 0.65rem 0; text-align: right; color: var(--text-muted);">${formatPaise(item.price)}</td>
        <td style="padding: 0.65rem 0; text-align: right; font-weight: 700;">${formatPaise((item.price || 0) * item.quantity)}</td>
      </tr>
    `).join('');

    const pricing = order.pricing || {};
    const addr = order.deliveryAddress || {};

    let partnerStatusHtml = '<span style="color: var(--text-muted);">Unassigned (Waiting for delivery pool pickup)</span>';
    if (order.deliveryPartnerId) {
      partnerStatusHtml = `<span style="color: var(--status-ready-text); font-weight: 600;">Assigned Partner: ${escapeHtml(order.deliveryPartnerId)}</span>`;
    }

    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
          <div>
            <div style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 800; color: var(--text-main);">
              ${escapeHtml(order.id)}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Placed at: ${formatDateTime(order.timestamps?.createdAt || order.createdAt)}
            </div>
          </div>
          <span class="badge ${getStatusBadgeClass(order.status)}">
            <span class="badge-dot"></span>
            ${escapeHtml(order.status)}
          </span>
        </div>

        <div>
          <h4 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem;">Customer &amp; Delivery Destination</h4>
          <div style="background-color: var(--bg-surface); border-radius: var(--radius-md); padding: 0.85rem 1rem; font-size: 0.9rem;">
            <div style="font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">${escapeHtml(order.customerName || 'Customer')}</div>
            <div style="color: var(--text-secondary); margin-bottom: 0.25rem;">📞 ${escapeHtml(order.customerPhone || 'Not provided')}</div>
            <div style="color: var(--text-secondary);">📍 ${escapeHtml(addr.street || '')}, ${escapeHtml(addr.city || '')} — ${escapeHtml(addr.pincode || '')}</div>
            <div style="margin-top: 0.5rem; font-size: 0.85rem; border-top: 1px solid var(--border-subtle); padding-top: 0.5rem;">
              🛵 ${partnerStatusHtml}
            </div>
          </div>
        </div>

        <div>
          <h4 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem;">Ordered Dishes</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-medium); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">
                <th style="padding: 0.5rem 0; text-align: left;">Item</th>
                <th style="padding: 0.5rem 0; text-align: center;">Qty</th>
                <th style="padding: 0.5rem 0; text-align: right;">Unit</th>
                <th style="padding: 0.5rem 0; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <div style="background-color: var(--bg-surface); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.9rem;">
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Subtotal:</span>
            <span>${formatPaise(pricing.subtotal || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Delivery Fee:</span>
            <span>${formatPaise(pricing.deliveryFee || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Taxes (5% GST):</span>
            <span>${formatPaise(pricing.tax || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.15rem; color: var(--text-main); border-top: 1px solid var(--border-medium); padding-top: 0.5rem; margin-top: 0.25rem;">
            <span>Total Amount:</span>
            <span style="color: var(--brand-primary);">${formatPaise(pricing.total || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }
}
