/**
 * Order Confirmation Modal Component
 * Displays confirmation details, canonical order ID, items list, and delivery summary
 */

export class OrderConfirmation {
  constructor({ modalElement, onClose }) {
    this.modal = modalElement;
    this.onClose = onClose;

    this.initElements();
    this.initEventListeners();
  }

  initElements() {
    this.closeBtn = this.modal.querySelector('#confirmation-close-btn');
    this.doneBtn = this.modal.querySelector('#confirmation-done-btn');
    this.orderIdEl = this.modal.querySelector('#confirmation-order-id');
    this.restaurantNameEl = this.modal.querySelector('#confirmation-restaurant-name');
    this.statusEl = this.modal.querySelector('#confirmation-status');
    this.addressEl = this.modal.querySelector('#confirmation-address');
    this.itemsContainerEl = this.modal.querySelector('#confirmation-items');
    this.totalEl = this.modal.querySelector('#confirmation-total');
    this.timestampEl = this.modal.querySelector('#confirmation-time');
  }

  initEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.doneBtn) {
      this.doneBtn.addEventListener('click', () => this.close());
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

    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (this.orderIdEl) this.orderIdEl.textContent = order.id || 'N/A';
    if (this.restaurantNameEl) this.restaurantNameEl.textContent = order.restaurantName || 'Restaurant';
    if (this.statusEl) this.statusEl.textContent = order.status || 'Placed';

    if (this.addressEl && order.deliveryAddress) {
      const addr = order.deliveryAddress;
      this.addressEl.textContent = `${addr.street}, ${addr.city} - ${addr.pincode}`;
    }

    if (this.itemsContainerEl && Array.isArray(order.items)) {
      this.itemsContainerEl.innerHTML = order.items.map((i) => `
        <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); padding: 0.35rem 0; border-bottom: 1px dashed var(--color-border-light);">
          <span>${i.quantity} × ${i.name}</span>
          <span style="font-weight: 600;">₹${i.price * i.quantity}</span>
        </div>
      `).join('');
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