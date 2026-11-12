/**
 * Order Confirmation Modal Component
 * Displays confirmation details, canonical order ID, items list, and delivery summary
 */

export class OrderConfirmation {
  constructor({ modalElement, onClose, onTrackOrder }) {
    this.modal = modalElement;
    this.onClose = onClose;
    this.onTrackOrder = onTrackOrder;
    this.currentOrder = null;

    this.initElements();
    this.initEventListeners();
  }

  initElements() {
    this.closeBtn = this.modal.querySelector('#confirmation-close-btn');
    this.doneBtn = this.modal.querySelector('#confirmation-done-btn');
    this.trackBtn = this.modal.querySelector('#confirmation-track-btn');
    this.orderIdEl = this.modal.querySelector('#confirmation-order-id');
    this.copyIdBtn = this.modal.querySelector('#confirmation-copy-id-btn');
    this.restaurantNameEl = this.modal.querySelector('#confirmation-restaurant-name');
    this.statusEl = this.modal.querySelector('#confirmation-status');
    this.addressEl = this.modal.querySelector('#confirmation-address');
    this.itemsContainerEl = this.modal.querySelector('#confirmation-items');
    this.totalEl = this.modal.querySelector('#confirmation-total');
    this.timestampEl = this.modal.querySelector('#confirmation-time');
    this.subtotalEl = this.modal.querySelector('#confirmation-subtotal');
    this.subtotalRowEl = this.modal.querySelector('#confirmation-subtotal-row');
    this.deliveryFeeEl = this.modal.querySelector('#confirmation-delivery-fee');
    this.deliveryRowEl = this.modal.querySelector('#confirmation-delivery-row');
  }

  initEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.doneBtn) {
      this.doneBtn.addEventListener('click', () => this.close());
    }

    if (this.copyIdBtn) {
      this.copyIdBtn.addEventListener('click', async () => {
        const orderId = this.currentOrder?.id;
        if (!orderId) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(orderId);
          }
        } catch {
          // Handled gracefully
        }
        const copyTextEl = this.copyIdBtn.querySelector('.copy-text');
        if (copyTextEl) copyTextEl.textContent = 'Copied!';
        setTimeout(() => {
          if (copyTextEl) copyTextEl.textContent = 'Copy';
        }, 2000);
      });
    }

    if (this.trackBtn) {
      this.trackBtn.addEventListener('click', () => {
        const order = this.currentOrder;
        this.close();
        if (order && typeof this.onTrackOrder === 'function') {
          this.onTrackOrder(order);
        }
      });
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  isOpen() {
    return this.modal.classList.contains('open');
  }

  open(order) {
    if (!order) return;
    this.currentOrder = order;

    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (this.orderIdEl) this.orderIdEl.textContent = order.id || 'N/A';
    if (this.restaurantNameEl) this.restaurantNameEl.textContent = order.restaurantName || 'Restaurant';
    if (this.statusEl) {
      const statusText = order.status || 'Placed';
      this.statusEl.innerHTML = `<span class="status-indicator-dot"></span> ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`;
    }

    if (this.addressEl && order.deliveryAddress) {
      const addr = order.deliveryAddress;
      this.addressEl.textContent = `${addr.street}, ${addr.city} - ${addr.pincode}`;
    }

    if (this.itemsContainerEl && Array.isArray(order.items)) {
      this.itemsContainerEl.innerHTML = order.items.map((i) => `
        <div class="confirmation-item-row">
          <div class="item-name-col">
            <span class="item-qty-tag">${i.quantity || 1}×</span>
            <span class="item-name-text">${i.name}</span>
          </div>
          <span class="item-price-text">₹${(i.price || 0) * (i.quantity || 1)}</span>
        </div>
      `).join('');
    }

    if (this.subtotalRowEl && this.subtotalEl) {
      if (order.pricing?.subtotal !== undefined) {
        this.subtotalRowEl.style.display = 'flex';
        this.subtotalEl.textContent = `₹${order.pricing.subtotal}`;
      } else {
        this.subtotalRowEl.style.display = 'none';
      }
    }

    if (this.deliveryRowEl && this.deliveryFeeEl) {
      if (order.pricing?.deliveryFee !== undefined) {
        this.deliveryRowEl.style.display = 'flex';
        this.deliveryFeeEl.textContent = order.pricing.deliveryFee === 0 ? 'FREE' : `₹${order.pricing.deliveryFee}`;
      } else {
        this.deliveryRowEl.style.display = 'none';
      }
    }

    if (this.totalEl) {
      const totalAmount = order.pricing?.total !== undefined ? order.pricing.total : '';
      this.totalEl.textContent = `₹${totalAmount}`;
    }

    if (this.timestampEl && order.timestamps?.createdAt) {
      const formattedTime = new Date(order.timestamps.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.timestampEl.textContent = `Placed at ${formattedTime}`;
    }
  }

  close() {
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }
}