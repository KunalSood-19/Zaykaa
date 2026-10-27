/**
 * Cart Drawer Component
 * Displays current cart items, quantities, bill details, and navigation to checkout
 */

export class CartDrawer {
  constructor({ drawerElement, cart, onProceedToCheckout }) {
    this.drawer = drawerElement;
    this.cart = cart;
    this.onProceedToCheckout = onProceedToCheckout;

    this.initElements();
    this.initEventListeners();

    // Subscribe to cart changes
    this.cart.subscribe((cartState, totals) => {
      this.render(cartState, totals);
    });
  }

  initElements() {
    this.closeBtn = this.drawer.querySelector('#cart-drawer-close-btn');
    this.itemsContainer = this.drawer.querySelector('#cart-items-container');
    this.emptyView = this.drawer.querySelector('#cart-empty-view');
    this.contentView = this.drawer.querySelector('#cart-content-view');
    this.restaurantNameEl = this.drawer.querySelector('#cart-restaurant-name');
    this.itemCountEl = this.drawer.querySelector('#cart-item-count');
    this.subtotalEl = this.drawer.querySelector('#cart-subtotal');
    this.deliveryFeeEl = this.drawer.querySelector('#cart-delivery-fee');
    this.taxEl = this.drawer.querySelector('#cart-tax');
    this.totalEl = this.drawer.querySelector('#cart-total');
    this.checkoutBtn = this.drawer.querySelector('#cart-checkout-btn');
    this.clearCartBtn = this.drawer.querySelector('#cart-clear-btn');
    this.exploreBtn = this.drawer.querySelector('#cart-explore-btn');
  }

  initEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Click on backdrop to close
    this.drawer.addEventListener('click', (e) => {
      if (e.target === this.drawer) {
        this.close();
      }
    });

    // Escape key to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    if (this.exploreBtn) {
      this.exploreBtn.addEventListener('click', () => {
        this.close();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
        }
      });
    }

    if (this.clearCartBtn) {
      this.clearCartBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your cart?')) {
          this.cart.clearCart();
        }
      });
    }

    if (this.checkoutBtn) {
      this.checkoutBtn.addEventListener('click', () => {
        const cartState = this.cart.getCart();
        if (cartState.items.length === 0) return;
        this.close();
        if (typeof this.onProceedToCheckout === 'function') {
          this.onProceedToCheckout();
        }
      });
    }
  }

  isOpen() {
    return this.drawer.classList.contains('open');
  }

  open() {
    this.drawer.classList.add('open');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const cartState = this.cart.getCart();
    const totals = this.cart.getTotals();
    this.render(cartState, totals);
  }

  close() {
    this.drawer.classList.remove('open');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  render(cartState, totals) {
    const hasItems = cartState && Array.isArray(cartState.items) && cartState.items.length > 0;

    if (!hasItems) {
      if (this.emptyView) this.emptyView.style.display = 'flex';
      if (this.contentView) this.contentView.style.display = 'none';
      if (this.restaurantNameEl) this.restaurantNameEl.textContent = '';
      if (this.itemCountEl) this.itemCountEl.textContent = '0 items';
      return;
    }

    if (this.emptyView) this.emptyView.style.display = 'none';
    if (this.contentView) this.contentView.style.display = 'flex';

    if (this.restaurantNameEl) {
      this.restaurantNameEl.textContent = `from ${cartState.restaurantName || 'Restaurant'}`;
    }

    const totalCount = this.cart.getItemCount();
    if (this.itemCountEl) {
      this.itemCountEl.textContent = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;
    }

    // Render items
    if (this.itemsContainer) {
      this.itemsContainer.innerHTML = cartState.items.map((item) => {
        const isVeg = Boolean(item.isVeg);
        const vegClass = isVeg ? 'veg' : 'non-veg';
        const lineTotal = item.price * item.quantity;

        return `
          <div class="cart-item-row" data-item-id="${item.itemId}">
            <div class="cart-item-info">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span class="veg-icon ${vegClass}" style="margin-bottom: 0;"></span>
                <span class="cart-item-name">${item.name}</span>
              </div>
              <span class="cart-item-price">₹${item.price} each</span>
            </div>

            <div class="cart-stepper">
              <button class="stepper-btn cart-minus-btn" data-item-id="${item.itemId}" type="button" aria-label="Decrease quantity">−</button>
              <span class="stepper-count">${item.quantity}</span>
              <button class="stepper-btn cart-plus-btn" data-item-id="${item.itemId}" type="button" aria-label="Increase quantity">+</button>
            </div>

            <div class="cart-item-total">₹${lineTotal}</div>
          </div>
        `;
      }).join('');

      // Bind steppers
      this.itemsContainer.querySelectorAll('.cart-minus-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-item-id');
          this.cart.updateQuantity(id, -1);
        });
      });

      this.itemsContainer.querySelectorAll('.cart-plus-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-item-id');
          this.cart.updateQuantity(id, 1);
        });
      });
    }

    // Render totals
    if (this.subtotalEl) this.subtotalEl.textContent = `₹${totals.subtotal}`;
    if (this.deliveryFeeEl) this.deliveryFeeEl.textContent = `₹${totals.deliveryFee}`;
    if (this.taxEl) this.taxEl.textContent = `₹${totals.tax}`;
    if (this.totalEl) this.totalEl.textContent = `₹${totals.total}`;
    if (this.checkoutBtn) {
      this.checkoutBtn.textContent = `Proceed to Checkout • ₹${totals.total}`;
    }
  }
}