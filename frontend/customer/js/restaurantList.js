/**
 * Restaurant List Component
 * Renders restaurant cards, loading skeletons, empty states, and errors
 */

export class RestaurantList {
  constructor({ containerElement, onSelectRestaurant }) {
    this.container = containerElement;
    this.onSelectRestaurant = onSelectRestaurant;
  }

  /**
   * Render loading skeleton placeholders
   */
  renderLoading(count = 6) {
    let skeletonsHtml = '';
    for (let i = 0; i < count; i++) {
      skeletonsHtml += `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-media"></div>
          <div class="skeleton-body">
            <div class="skeleton-line w-75"></div>
            <div class="skeleton-line w-50"></div>
            <div class="skeleton-line w-35" style="margin-top: auto;"></div>
          </div>
        </div>
      `;
    }
    this.container.innerHTML = skeletonsHtml;
  }

  showSkeletons(count = 6) {
    this.renderLoading(count);
  }

  showError(error, onRetry) {
    this.renderError(typeof error === 'string' ? { message: error } : error, onRetry);
  }

  /**
   * Render error state with retry action
   */
  renderError(error, onRetry) {
    this.container.innerHTML = `
      <div class="state-container" style="grid-column: 1 / -1;">
        <div class="state-icon" aria-hidden="true">⚠️</div>
        <h3 class="state-title">Unable to Load Restaurants</h3>
        <p class="state-message">${error?.message || 'Something went wrong while connecting to Zaykaa API.'}</p>
        <button id="retry-fetch-btn" class="btn-primary" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Try Again
        </button>
      </div>
    `;

    const retryBtn = document.getElementById('retry-fetch-btn');
    if (retryBtn && typeof onRetry === 'function') {
      retryBtn.addEventListener('click', onRetry);
    }
  }

  /**
   * Render empty state when search/filter returns zero results
   */
  renderEmpty({ onResetFilters }) {
    this.container.innerHTML = `
      <div class="state-container" style="grid-column: 1 / -1;">
        <div class="state-icon" aria-hidden="true">🍽️</div>
        <h3 class="state-title">No Restaurants Found</h3>
        <p class="state-message">We couldn't find any restaurants matching your current search or filters. Try adjusting your query or resetting filters.</p>
        <button id="reset-filters-btn" class="btn-outline" type="button">Reset All Filters</button>
      </div>
    `;

    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn && typeof onResetFilters === 'function') {
      resetBtn.addEventListener('click', onResetFilters);
    }
  }

  /**
   * Universal render method (renders cards if present, otherwise empty state)
   */
  render(restaurants = [], options = {}) {
    if (!restaurants || restaurants.length === 0) {
      this.renderEmpty(options);
      return;
    }
    this.renderRestaurants(restaurants);
  }

  /**
   * Render list of restaurants from backend API
   */
  renderRestaurants(restaurants = []) {
    if (!restaurants || restaurants.length === 0) {
      return;
    }

    this.container.innerHTML = restaurants.map((r) => this.createCardHtml(r)).join('');

    // Attach click listeners
    const cards = this.container.querySelectorAll('.restaurant-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const restaurantId = card.getAttribute('data-id');
        if (restaurantId && typeof this.onSelectRestaurant === 'function') {
          this.onSelectRestaurant(restaurantId);
        }
      });
      // Keyboard Enter or Space to open
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const restaurantId = card.getAttribute('data-id');
          if (restaurantId && typeof this.onSelectRestaurant === 'function') {
            this.onSelectRestaurant(restaurantId);
          }
        }
      });
    });
  }

  /**
   * Generates single restaurant card markup
   */
  createCardHtml(restaurant) {
    const cuisinesText = Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(' • ') : 'Multi-cuisine';
    const isOpen = Boolean(restaurant.isOpen);
    const statusBadge = isOpen
      ? '<span class="badge-pill badge-open">Open</span>'
      : '<span class="badge-pill badge-closed">Closed</span>';
    const vegBadge = restaurant.isVegOnly
      ? '<span class="badge-pill badge-veg-only">Veg Only</span>'
      : '';
    const ratingText = restaurant.rating ? Number(restaurant.rating).toFixed(1) : 'New';
    const ratingCount = restaurant.ratingCount ? `(${restaurant.ratingCount})` : '';

    const initial = restaurant.name ? restaurant.name.charAt(0).toUpperCase() : 'Z';
    const deliveryTime = restaurant.deliveryTimeEstimate || `${restaurant.deliveryTimeMinutes || 30} mins`;
    const costForTwo = restaurant.costForTwo ? `₹${restaurant.costForTwo} for two` : '₹500 for two';

    return `
      <article
        class="restaurant-card"
        data-id="${restaurant.id}"
        tabindex="0"
        role="button"
        aria-label="View menu for ${restaurant.name}, rating ${ratingText}"
      >
        <div class="card-media">
          <div class="card-media-placeholder">
            <span>${initial}</span>
          </div>
          <div class="card-badges">
            <div style="display: flex; gap: 0.35rem;">
              ${statusBadge}
              ${vegBadge}
            </div>
            <div class="badge-rating" aria-label="Rating: ${ratingText}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>${ratingText}</span>
              <span style="font-size: 0.65rem; color: #78350f; font-weight: normal;">${ratingCount}</span>
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="card-title-row">
            <h3 class="restaurant-name" title="${restaurant.name}">${restaurant.name}</h3>
          </div>
          <p class="restaurant-cuisines" title="${cuisinesText}">${cuisinesText}</p>

          <div class="card-meta-row">
            <div class="meta-item" title="Estimated delivery time">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>${deliveryTime}</span>
            </div>
            <div class="meta-item" title="Approximate cost for two">
              <span>${costForTwo}</span>
            </div>
          </div>

          <div class="card-action-btn">View Menu &amp; Details &rarr;</div>
        </div>
      </article>
    `;
  }
}
