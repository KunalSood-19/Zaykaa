/**
 * Checkout Modal Component
 * Collects delivery details, provides order summary, and posts order to the backend
 */

export class CheckoutModal {
  constructor({ modalElement, api, cart, onOrderSuccess }) {
    this.modal = modalElement;
    this.api = api;
    this.cart = cart;
    this.onOrderSuccess = onOrderSuccess;
    this.isSubmitting = false;

    this.initElements();
    this.initEventListeners();
  }

  initElements() {
    this.closeBtn = this.modal.querySelector('#checkout-close-btn');
    this.backToCartBtn = this.modal.querySelector('#checkout-back-btn');
    this.form = this.modal.querySelector('#checkout-form');
    this.streetInput = this.modal.querySelector('#delivery-street');
    this.cityInput = this.modal.querySelector('#delivery-city');
    this.pincodeInput = this.modal.querySelector('#delivery-pincode');
    this.errorBanner = this.modal.querySelector('#checkout-error-banner');
    this.errorMessage = this.modal.querySelector('#checkout-error-message');
    this.submitBtn = this.modal.querySelector('#checkout-submit-btn');

    this.summaryItemsList = this.modal.querySelector('#checkout-summary-items');
    this.summaryRestaurantName = this.modal.querySelector('#checkout-restaurant-name');
    this.summarySubtotal = this.modal.querySelector('#checkout-summary-subtotal');
    this.summaryDeliveryFee = this.modal.querySelector('#checkout-summary-delivery-fee');
    this.summaryTax = this.modal.querySelector('#checkout-summary-tax');
    this.summaryTotal = this.modal.querySelector('#checkout-summary-total');
  }

  initEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.backToCartBtn) {
      this.backToCartBtn.addEventListener('click', () => {
        this.close();
        // Custom event to re-open cart
        window.dispatchEvent(new CustomEvent('zaykaa:open-cart'));
      });
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal && !this.isSubmitting) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen() && !this.isSubmitting) {
        this.close();
      }
    });

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }
  }

  isOpen() {
    return this.modal.classList.contains('open');
  }

  async open() {
    const cartState = this.cart.getCart();
    if (!cartState.items || cartState.items.length === 0) {
      alert('Your cart is empty! Please add items before checking out.');
      return;
    }

    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    this.hideError();
    this.renderSummary();

    // Auto-fill delivery address from customer profile if empty
    if (this.streetInput && !this.streetInput.value.trim()) {
      try {
        const profileRes = await this.api.getCustomerProfile();
        const profile = profileRes.data;
        if (profile && Array.isArray(profile.addresses) && profile.addresses.length > 0) {
          const defaultAddr = profile.addresses.find((a) => a.isDefault) || profile.addresses[0];
          if (defaultAddr) {
            if (this.streetInput) this.streetInput.value = defaultAddr.street || '';
            if (this.cityInput) this.cityInput.value = defaultAddr.city || 'Bengaluru';
            if (this.pincodeInput) this.pincodeInput.value = defaultAddr.pincode || '560100';
          }
        }
      } catch {
        // Fallback to defaults
        if (this.cityInput && !this.cityInput.value) this.cityInput.value = 'Bengaluru';
      }
    }
  }

  close() {
    if (this.isSubmitting) return;
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.hideError();
  }

  renderSummary() {
    const cartState = this.cart.getCart();
    const totals = this.cart.getTotals();

    if (this.summaryRestaurantName) {
      this.summaryRestaurantName.textContent = cartState.restaurantName || 'Restaurant';
    }

    if (this.summaryItemsList) {
      this.summaryItemsList.innerHTML = cartState.items.map((item) => `
        <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: 0.35rem;">
          <span style="color: var(--color-text-main); font-weight: 500;">
            ${item.quantity} × ${item.name}
          </span>
          <span style="font-weight: 600;">₹${item.price * item.quantity}</span>
        </div>
      `).join('');
    }

    if (this.summarySubtotal) this.summarySubtotal.textContent = `₹${totals.subtotal}`;
    if (this.summaryDeliveryFee) this.summaryDeliveryFee.textContent = `₹${totals.deliveryFee}`;
    if (this.summaryTax) this.summaryTax.textContent = `₹${totals.tax}`;
    if (this.summaryTotal) this.summaryTotal.textContent = `₹${totals.total}`;

    if (this.submitBtn) {
      this.submitBtn.innerHTML = `Confirm &amp; Place Order • ₹${totals.total}`;
    }
  }

  showError(msg) {
    if (this.errorBanner && this.errorMessage) {
      this.errorMessage.textContent = msg;
      this.errorBanner.style.display = 'flex';
      this.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  hideError() {
    if (this.errorBanner) {
      this.errorBanner.style.display = 'none';
    }
  }

  async handleSubmit() {
    if (this.isSubmitting) return;

    const cartState = this.cart.getCart();
    if (!cartState.items || cartState.items.length === 0) {
      this.showError('Your cart is empty. Please add items to checkout.');
      return;
    }

    const street = this.streetInput?.value?.trim();
    const city = this.cityInput?.value?.trim();
    const pincode = this.pincodeInput?.value?.trim();

    // Field-level validation
    if (!street) {
      this.showError('Please enter a delivery street address.');
      this.streetInput?.focus();
      return;
    }

    if (!city) {
      this.showError('Please enter a delivery city.');
      this.cityInput?.focus();
      return;
    }

    if (!pincode || !/^\d{6}$/.test(pincode)) {
      this.showError('Please enter a valid 6-digit delivery pincode (e.g. 560100).');
      this.pincodeInput?.focus();
      return;
    }

    this.hideError();
    this.setSubmitting(true);

    const payload = {
      restaurantId: cartState.restaurantId,
      items: cartState.items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity
      })),
      deliveryAddress: {
        street,
        city,
        pincode
      }
    };

    try {
      const response = await this.api.createOrder(payload);

      if (response && response.success && response.data) {
        // Clear local cart upon confirmed order creation
        this.cart.clearCart();
        this.close();

        if (typeof this.onOrderSuccess === 'function') {
          this.onOrderSuccess(response.data);
        }
      } else {
        throw new Error(response?.error?.message || 'Failed to place order.');
      }
    } catch (err) {
      this.showError(err.message || 'Unable to create order. Please try again.');
    } finally {
      this.setSubmitting(false);
    }
  }

  setSubmitting(submitting) {
    this.isSubmitting = submitting;
    if (this.submitBtn) {
      this.submitBtn.disabled = submitting;
      if (submitting) {
        this.submitBtn.innerHTML = `
          <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 6px;">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          Placing Order...
        `;
      } else {
        const totals = this.cart.getTotals();
        this.submitBtn.innerHTML = `Confirm &amp; Place Order • ₹${totals.total}`;
      }
    }
  }
}