/**
 * Zaykaa Customer Portal — Order History Component
 * Manages customer order listing, status filtering, and order card rendering
 */

export class OrderHistory {
  constructor({ containerElement, api, onSelectOrder, onExploreRestaurants }) {
    this.container = containerElement;
    this.api = api;
    this.onSelectOrder = onSelectOrder;
    this.onExploreRestaurants = onExploreRestaurants;

    this.currentFilter = 'all'; // 'all' | 'active' | 'delivered' | 'cancelled'
    this.orders = [];
    this.isLoading = false;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.filterButtons = document.querySelectorAll('.order-filter-chip');
    this.refreshBtn = document.getElementById('refresh-orders-btn');
    this.ordersList = document.getElementById('orders-cards-list');
    this.ordersSkeleton = document.getElementById('orders-skeleton');
    this.ordersEmpty = document.getElementById('orders-empty-state');
    this.ordersError = document.getElementById('orders-error-state');
    this.errorMessageEl = document.getElementById('orders-error-message');
    this.retryBtn = document.getElementById('orders-retry-btn');
    this.exploreBtn = document.getElementById('orders-empty-explore-btn');
  }

  bindEvents() {
    // Filter chip clicks
    if (this.filterButtons) {
      this.filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const status = btn.dataset.status || 'all';
          this.setFilter(status);
        });
      });
    }

    // Refresh button
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        this.loadOrders(true);
      });
    }

    // Retry button in error state
    if (this.retryBtn) {
      this.retryBtn.addEventListener('click', () => {
        this.loadOrders();
      });
    }

    // Empty state explore button
    if (this.exploreBtn) {
      this.exploreBtn.addEventListener('click', () => {
        if (typeof this.onExploreRestaurants === 'function') {
          this.onExploreRestaurants();
        }
      });
    }

    // Order card clicks via event delegation
    if (this.ordersList) {
      this.ordersList.addEventListener('click', (e) => {
        const card = e.target.closest('.order-card');
        if (!card) return;
        const orderId = card.dataset.orderId;
        if (orderId && typeof this.onSelectOrder === 'function') {
          this.onSelectOrder(orderId);
        }
      });
    }
  }

  setFilter(status) {
    this.currentFilter = status;
    if (this.filterButtons) {
      this.filterButtons.forEach((btn) => {
        const isActive = (btn.dataset.status || 'all') === status;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }
    this.render();
  }

  async loadOrders(isManualRefresh = false) {
    this.isLoading = true;
    this.showState('loading');

    if (this.refreshBtn && isManualRefresh) {
      this.refreshBtn.classList.add('rotating');
    }

    try {
      const response = await this.api.getCustomerOrders({ page: 1, limit: 50 });
      this.orders = Array.isArray(response.data) ? response.data : [];
      this.render();
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      if (this.errorMessageEl) {
        this.errorMessageEl.textContent = err.message || 'Unable to load orders. Please check your connection and retry.';
      }
      this.showState('error');
    } finally {
      this.isLoading = false;
      if (this.refreshBtn) {
        this.refreshBtn.classList.remove('rotating');
      }
    }
  }

  filterOrders() {
    if (this.currentFilter === 'all') {
      return this.orders;
    }

    const activeStatuses = ['placed', 'accepted', 'preparing', 'ready for pickup', 'picked up', 'out for delivery'];
    const deliveredStatuses = ['delivered'];
    const cancelledStatuses = ['cancelled', 'rejected'];

    return this.orders.filter((order) => {
      const status = (order.status || '').toLowerCase().trim();
      if (this.currentFilter === 'active') {
        return activeStatuses.includes(status);
      }
      if (this.currentFilter === 'delivered') {
        return deliveredStatuses.includes(status);
      }
      if (this.currentFilter === 'cancelled') {
        return cancelledStatuses.includes(status);
      }
      return true;
    });
  }

  render() {
    const filteredOrders = this.filterOrders();

    if (this.orders.length === 0) {
      this.showState('empty');
      return;
    }

    if (filteredOrders.length === 0) {
      // Empty for specific filter
      this.showState('empty-filter');
      return;
    }

    this.showState('content');
    this.ordersList.innerHTML = filteredOrders.map((order) => this.renderOrderCard(order)).join('');
  }

  showState(state) {
    if (this.ordersSkeleton) this.ordersSkeleton.style.display = state === 'loading' ? 'grid' : 'none';
    if (this.ordersEmpty) this.ordersEmpty.style.display = (state === 'empty' || state === 'empty-filter') ? 'flex' : 'none';
    if (this.ordersError) this.ordersError.style.display = state === 'error' ? 'flex' : 'none';
    if (this.ordersList) this.ordersList.style.display = state === 'content' ? 'grid' : 'none';

    // Update empty state text if filter is active
    if (this.ordersEmpty && (state === 'empty' || state === 'empty-filter')) {
      const titleEl = this.ordersEmpty.querySelector('.state-title');
      const descEl = this.ordersEmpty.querySelector('.state-message');
      if (state === 'empty-filter') {
        if (titleEl) titleEl.textContent = `No ${this.getFilterLabel()} Orders`;
        if (descEl) descEl.textContent = `You don't have any orders matching the "${this.getFilterLabel()}" status.`;
      } else {
        if (titleEl) titleEl.textContent = 'No Orders Yet';
        if (descEl) descEl.textContent = 'You haven’t placed any orders yet. Discover top restaurants and satisfy your cravings!';
      }
    }
  }

  getFilterLabel() {
    switch (this.currentFilter) {
      case 'active': return 'Active';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Matching';
    }
  }

  renderOrderCard(order) {
    const orderId = order.id || 'N/A';
    const restaurantName = order.restaurantName || 'Zaykaa Kitchen';
    const status = order.status || 'Placed';
    const total = order.pricing?.total !== undefined ? `₹${order.pricing.total}` : '₹--';
    
    // Safely format date
    const dateStr = this.formatDate(order.timestamps?.createdAt || order.createdAt);

    // Items preview
    let itemsPreview = '';
    if (Array.isArray(order.items) && order.items.length > 0) {
      itemsPreview = order.items
        .map((item) => `${item.quantity || 1}x ${item.name || 'Dish'}`)
        .join(', ');
    } else {
      itemsPreview = 'Delicious curated items';
    }

    const statusBadgeClass = this.getStatusBadgeClass(status);

    return `
      <article class="order-card" data-order-id="${this.escapeHtml(orderId)}" tabindex="0" role="button" aria-label="View order ${this.escapeHtml(orderId)} from ${this.escapeHtml(restaurantName)}">
        <div class="order-card-header">
          <div class="order-restaurant-info">
            <div class="order-restaurant-avatar" aria-hidden="true">🍲</div>
            <div>
              <h3 class="order-restaurant-name">${this.escapeHtml(restaurantName)}</h3>
              <div class="order-id-meta">Order #${this.escapeHtml(orderId)} &bull; ${this.escapeHtml(dateStr)}</div>
            </div>
          </div>
          <span class="status-badge ${statusBadgeClass}">${this.escapeHtml(status)}</span>
        </div>

        <div class="order-card-body">
          <p class="order-items-preview">${this.escapeHtml(itemsPreview)}</p>
        </div>

        <div class="order-card-footer">
          <div class="order-price-group">
            <span class="order-price-label">Total Amount</span>
            <span class="order-price-val">${total}</span>
          </div>

          <button class="btn-track-order" type="button" aria-label="Track and view details for order ${this.escapeHtml(orderId)}">
            <span>Track &amp; Details</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </article>
    `;
  }

  getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase().trim();
    switch (s) {
      case 'placed':
        return 'badge-placed';
      case 'accepted':
        return 'badge-accepted';
      case 'preparing':
        return 'badge-preparing';
      case 'ready for pickup':
        return 'badge-ready';
      case 'picked up':
      case 'out for delivery':
        return 'badge-transit';
      case 'delivered':
        return 'badge-delivered';
      case 'cancelled':
        return 'badge-cancelled';
      case 'rejected':
        return 'badge-rejected';
      default:
        return 'badge-default';
    }
  }

  formatDate(dateVal) {
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
