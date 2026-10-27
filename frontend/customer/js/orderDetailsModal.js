/**
 * Zaykaa Customer Portal — Order Details & Live Status Tracking Modal
 * Provides order inspection, canonical lifecycle timeline, status refresh, and cancellation
 */

export class OrderDetailsModal {
  constructor({ modalElement, cancelModalElement, api, onOrderCancelled }) {
    this.modalEl = modalElement;
    this.cancelModalEl = cancelModalElement;
    this.api = api;
    this.onOrderCancelled = onOrderCancelled;

    this.currentOrder = null;
    this.isLoading = false;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    if (!this.modalEl) return;

    // Header & Meta
    this.closeBtn = this.modalEl.querySelector('#order-details-close-btn');
    this.orderIdEl = this.modalEl.querySelector('#details-order-id');
    this.orderDateEl = this.modalEl.querySelector('#details-order-date');
    this.statusBadgeEl = this.modalEl.querySelector('#details-status-badge');

    // Live Actions
    this.refreshBtn = this.modalEl.querySelector('#details-refresh-btn');
    this.cancelOrderBtn = this.modalEl.querySelector('#details-cancel-btn');

    // Status Timeline & Alerts
    this.timelineContainer = this.modalEl.querySelector('#details-timeline-container');
    this.terminalAlertContainer = this.modalEl.querySelector('#details-terminal-alert');

    // Restaurant & Delivery
    this.restaurantNameEl = this.modalEl.querySelector('#details-restaurant-name');
    this.restaurantAddressEl = this.modalEl.querySelector('#details-restaurant-address');
    this.customerNameEl = this.modalEl.querySelector('#details-customer-name');
    this.customerPhoneEl = this.modalEl.querySelector('#details-customer-phone');
    this.deliveryAddressEl = this.modalEl.querySelector('#details-delivery-address');

    // Items & Pricing
    this.itemsContainerEl = this.modalEl.querySelector('#details-items-list');
    this.subtotalEl = this.modalEl.querySelector('#details-subtotal');
    this.deliveryFeeEl = this.modalEl.querySelector('#details-delivery-fee');
    this.taxEl = this.modalEl.querySelector('#details-tax');
    this.totalEl = this.modalEl.querySelector('#details-total');

    // Loading & Error overlays
    this.loadingOverlay = this.modalEl.querySelector('#details-loading-overlay');
    this.errorOverlay = this.modalEl.querySelector('#details-error-overlay');
    this.errorMessageEl = this.modalEl.querySelector('#details-error-message');

    // Cancel Confirm Dialog elements
    if (this.cancelModalEl) {
      this.cancelCloseBtn = this.cancelModalEl.querySelector('#cancel-dialog-close-btn');
      this.cancelKeepBtn = this.cancelModalEl.querySelector('#cancel-dialog-keep-btn');
      this.cancelConfirmBtn = this.cancelModalEl.querySelector('#cancel-dialog-confirm-btn');
      this.cancelReasonInput = this.cancelModalEl.querySelector('#cancel-reason-input');
      this.cancelErrorBanner = this.cancelModalEl.querySelector('#cancel-error-banner');
    }
  }

  bindEvents() {
    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click to close
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.close();
        }
      });
    }

    // Refresh button
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        if (this.currentOrder?.id) {
          this.refreshStatus();
        }
      });
    }

    // Open Cancel Order confirmation
    if (this.cancelOrderBtn) {
      this.cancelOrderBtn.addEventListener('click', () => {
        this.openCancelDialog();
      });
    }

    // Cancel Dialog buttons
    if (this.cancelCloseBtn) {
      this.cancelCloseBtn.addEventListener('click', () => this.closeCancelDialog());
    }
    if (this.cancelKeepBtn) {
      this.cancelKeepBtn.addEventListener('click', () => this.closeCancelDialog());
    }
    if (this.cancelConfirmBtn) {
      this.cancelConfirmBtn.addEventListener('click', () => this.executeCancelOrder());
    }

    // Global Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.cancelModalEl && this.cancelModalEl.getAttribute('aria-hidden') === 'false') {
          this.closeCancelDialog();
        } else if (this.modalEl && this.modalEl.getAttribute('aria-hidden') === 'false') {
          this.close();
        }
      }
    });
  }

  async open(orderId) {
    if (!this.modalEl || !orderId) return;

    this.modalEl.setAttribute('aria-hidden', 'false');
    this.modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';

    await this.fetchAndRenderOrder(orderId);
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.setAttribute('aria-hidden', 'true');
    this.modalEl.classList.remove('open');
    document.body.style.overflow = '';
    this.currentOrder = null;
  }

  async fetchAndRenderOrder(orderId) {
    this.showOverlay('loading');
    try {
      const response = await this.api.getOrderById(orderId);
      this.currentOrder = response.data;
      this.render();
      this.showOverlay('none');
    } catch (err) {
      console.error('Failed to load order details:', err);
      let msg = err.message || 'Unable to retrieve order details.';
      if (err.status === 403 || err.code === 'FORBIDDEN_ORDER_ACCESS') {
        msg = 'Access Denied: You do not have authorization to view this customer order.';
      } else if (err.status === 404 || err.code === 'ORDER_NOT_FOUND') {
        msg = `Order with ID "${orderId}" was not found.`;
      }
      if (this.errorMessageEl) {
        this.errorMessageEl.textContent = msg;
      }
      this.showOverlay('error');
    }
  }

  async refreshStatus() {
    if (!this.currentOrder?.id) return;
    if (this.refreshBtn) {
      this.refreshBtn.classList.add('rotating');
    }

    try {
      const response = await this.api.getOrderById(this.currentOrder.id);
      this.currentOrder = response.data;
      this.render();
    } catch (err) {
      console.error('Failed to refresh order status:', err);
    } finally {
      if (this.refreshBtn) {
        this.refreshBtn.classList.remove('rotating');
      }
    }
  }

  render() {
    const o = this.currentOrder;
    if (!o) return;

    // Header info
    if (this.orderIdEl) this.orderIdEl.textContent = `Order #${o.id || ''}`;
    if (this.orderDateEl) this.orderDateEl.textContent = `Placed on ${this.formatFullDate(o.timestamps?.createdAt || o.createdAt)}`;

    // Status Badge
    const status = o.status || 'Placed';
    if (this.statusBadgeEl) {
      this.statusBadgeEl.textContent = status;
      this.statusBadgeEl.className = `status-badge ${this.getStatusBadgeClass(status)}`;
    }

    // Render Status Progression Timeline or Terminal State Alert
    this.renderLifecycleTracker(status, o);

    // Cancel Button visibility & state
    // According to contract: Cancel allowed only while Placed or Accepted (before Preparing)
    const canCancel = ['placed', 'accepted'].includes(status.toLowerCase().trim());
    if (this.cancelOrderBtn) {
      this.cancelOrderBtn.style.display = canCancel ? 'inline-flex' : 'none';
      this.cancelOrderBtn.disabled = !canCancel;
    }

    // Restaurant details
    if (this.restaurantNameEl) this.restaurantNameEl.textContent = o.restaurantName || 'Zaykaa Partner';
    if (this.restaurantAddressEl) {
      this.restaurantAddressEl.textContent = 'Authentic Kitchens, Bengaluru';
    }

    // Customer & Delivery Address details
    if (this.customerNameEl) this.customerNameEl.textContent = o.customerName || 'Tarshit Gupta';
    if (this.customerPhoneEl) this.customerPhoneEl.textContent = o.customerPhone || '+91 98765 43210';
    if (this.deliveryAddressEl) {
      const addr = o.deliveryAddress || {};
      const parts = [addr.street, addr.city, addr.pincode].filter(Boolean);
      this.deliveryAddressEl.textContent = parts.length > 0 ? parts.join(', ') : 'Delivery Address';
    }

    // Items Breakdown list
    if (this.itemsContainerEl) {
      const items = Array.isArray(o.items) ? o.items : [];
      this.itemsContainerEl.innerHTML = items.map((item) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.price) || 0;
        const lineTotal = qty * unitPrice;
        return `
          <div class="order-detail-item-row">
            <div class="detail-item-info">
              <span class="detail-item-qty">${qty}x</span>
              <span class="detail-item-name">${this.escapeHtml(item.name || 'Dish')}</span>
            </div>
            <div class="detail-item-pricing">
              <span class="detail-item-unit">₹${unitPrice} each</span>
              <span class="detail-item-total">₹${lineTotal}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Pricing details
    const pricing = o.pricing || {};
    if (this.subtotalEl) this.subtotalEl.textContent = `₹${pricing.subtotal !== undefined ? pricing.subtotal : '--'}`;
    if (this.deliveryFeeEl) this.deliveryFeeEl.textContent = `₹${pricing.deliveryFee !== undefined ? pricing.deliveryFee : 40}`;
    if (this.taxEl) this.taxEl.textContent = `₹${pricing.tax !== undefined ? pricing.tax : '--'}`;
    if (this.totalEl) this.totalEl.textContent = `₹${pricing.total !== undefined ? pricing.total : '--'}`;
  }

  renderLifecycleTracker(currentStatus, order) {
    const s = (currentStatus || '').toLowerCase().trim();

    // If cancelled or rejected, show terminal alert card
    if (s === 'cancelled' || s === 'rejected') {
      if (this.timelineContainer) this.timelineContainer.style.display = 'none';
      if (this.terminalAlertContainer) {
        this.terminalAlertContainer.style.display = 'block';
        const isCancelled = s === 'cancelled';
        this.terminalAlertContainer.className = `terminal-alert-box ${isCancelled ? 'alert-cancelled' : 'alert-rejected'}`;
        this.terminalAlertContainer.innerHTML = `
          <div class="terminal-alert-icon">${isCancelled ? '🛑' : '❌'}</div>
          <div>
            <h4 class="terminal-alert-title">${isCancelled ? 'Order Cancelled' : 'Order Rejected by Restaurant'}</h4>
            <p class="terminal-alert-desc">
              ${order.cancellationReason || (isCancelled ? 'This order was cancelled before cooking started.' : 'The restaurant could not fulfill this order.')}
            </p>
            <span class="terminal-alert-time">Updated on ${this.formatFullDate(order.timestamps?.updatedAt || order.updatedAt)}</span>
          </div>
        `;
      }
      return;
    }

    // Active lifecycle timeline
    if (this.terminalAlertContainer) this.terminalAlertContainer.style.display = 'none';
    if (this.timelineContainer) {
      this.timelineContainer.style.display = 'block';

      const steps = [
        { key: 'placed', label: 'Order Placed', desc: 'Received & sent to kitchen' },
        { key: 'accepted', label: 'Confirmed', desc: 'Restaurant confirmed' },
        { key: 'preparing', label: 'Cooking', desc: 'Prepared with fresh ingredients' },
        { key: 'ready for pickup', label: 'Food Packed', desc: 'Waiting for pickup' },
        { key: 'out for delivery', label: 'En Route', desc: 'Delivery partner on the way' },
        { key: 'delivered', label: 'Delivered', desc: 'Enjoy your cravings!' }
      ];

      // Determine progression index
      let activeIndex = 0;
      if (s === 'accepted') activeIndex = 1;
      else if (s === 'preparing') activeIndex = 2;
      else if (s === 'ready for pickup') activeIndex = 3;
      else if (s === 'picked up' || s === 'out for delivery') activeIndex = 4;
      else if (s === 'delivered') activeIndex = 5;

      this.timelineContainer.innerHTML = `
        <div class="timeline-stepper">
          ${steps.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const stateClass = isCompleted ? 'step-completed' : (isCurrent ? 'step-current' : 'step-upcoming');

            return `
              <div class="timeline-step ${stateClass}">
                <div class="step-indicator">
                  <div class="step-dot">
                    ${isCompleted ? '✓' : idx + 1}
                  </div>
                  ${idx < steps.length - 1 ? '<div class="step-line"></div>' : ''}
                </div>
                <div class="step-content">
                  <div class="step-title">${step.label}</div>
                  <div class="step-desc">${step.desc}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  openCancelDialog() {
    if (!this.cancelModalEl || !this.currentOrder) return;
    if (this.cancelReasonInput) this.cancelReasonInput.value = '';
    if (this.cancelErrorBanner) this.cancelErrorBanner.style.display = 'none';
    this.cancelModalEl.setAttribute('aria-hidden', 'false');
    this.cancelModalEl.classList.add('open');
  }

  closeCancelDialog() {
    if (!this.cancelModalEl) return;
    this.cancelModalEl.setAttribute('aria-hidden', 'true');
    this.cancelModalEl.classList.remove('open');
  }

  async executeCancelOrder() {
    if (!this.currentOrder?.id) return;

    const reason = this.cancelReasonInput ? this.cancelReasonInput.value.trim() : 'Cancelled by customer';

    if (this.cancelConfirmBtn) {
      this.cancelConfirmBtn.disabled = true;
      this.cancelConfirmBtn.textContent = 'Cancelling...';
    }

    try {
      const response = await this.api.cancelOrder(this.currentOrder.id, reason);
      this.currentOrder = response.data;
      this.closeCancelDialog();
      this.render();

      if (typeof this.onOrderCancelled === 'function') {
        this.onOrderCancelled(this.currentOrder.id);
      }
    } catch (err) {
      console.error('Cancellation failed:', err);
      if (this.cancelErrorBanner) {
        this.cancelErrorBanner.style.display = 'flex';
        this.cancelErrorBanner.textContent = err.message || 'Unable to cancel this order. Preparation may have already begun.';
      }
    } finally {
      if (this.cancelConfirmBtn) {
        this.cancelConfirmBtn.disabled = false;
        this.cancelConfirmBtn.textContent = 'Confirm Cancellation';
      }
    }
  }

  showOverlay(type) {
    if (this.loadingOverlay) this.loadingOverlay.style.display = type === 'loading' ? 'flex' : 'none';
    if (this.errorOverlay) this.errorOverlay.style.display = type === 'error' ? 'flex' : 'none';
  }

  getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase().trim();
    switch (s) {
      case 'placed': return 'badge-placed';
      case 'accepted': return 'badge-accepted';
      case 'preparing': return 'badge-preparing';
      case 'ready for pickup': return 'badge-ready';
      case 'picked up':
      case 'out for delivery': return 'badge-transit';
      case 'delivered': return 'badge-delivered';
      case 'cancelled': return 'badge-cancelled';
      case 'rejected': return 'badge-rejected';
      default: return 'badge-default';
    }
  }

  formatFullDate(dateVal) {
    if (!dateVal) return 'Recently';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Recently';
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return 'Recently';
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
