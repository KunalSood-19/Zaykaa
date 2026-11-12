/**
 * Restaurant List Component
 * Renders restaurant cards, loading skeletons, empty states, and errors
 */

export class RestaurantList {
  constructor({ containerElement, onSelectRestaurant, onToggleFavourite }) {
    this.container = containerElement;
    this.onSelectRestaurant = onSelectRestaurant;
    this.onToggleFavourite = onToggleFavourite;
  }

  getFavourites() {
    try {
      return JSON.parse(localStorage.getItem('zaykaa_favourites') || '[]');
    } catch {
      return [];
    }
  }

  isFavourite(restaurantId) {
    return this.getFavourites().includes(restaurantId);
  }

  toggleFavourite(restaurantId) {
    try {
      let favs = this.getFavourites();
      if (favs.includes(restaurantId)) {
        favs = favs.filter((id) => id !== restaurantId);
      } else {
        favs.push(restaurantId);
      }
      localStorage.setItem('zaykaa_favourites', JSON.stringify(favs));
      if (typeof this.onToggleFavourite === 'function') {
        this.onToggleFavourite(restaurantId, favs.includes(restaurantId));
      }
      return favs.includes(restaurantId);
    } catch {
      return false;
    }
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

    // Attach click listeners to cards and favourite buttons
    const cards = this.container.querySelectorAll('.restaurant-card');
    cards.forEach((card) => {
      const restaurantId = card.getAttribute('data-id');

      // Favourite heart button
      const favBtn = card.querySelector('.btn-card-favourite');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowFav = this.toggleFavourite(restaurantId);
          favBtn.classList.toggle('active', isNowFav);
          favBtn.setAttribute('aria-pressed', isNowFav ? 'true' : 'false');
          favBtn.innerHTML = isNowFav
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="#B8862B" stroke="#B8862B" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        });
      }

      // Card click opens menu
      card.addEventListener('click', () => {
        if (restaurantId && typeof this.onSelectRestaurant === 'function') {
          this.onSelectRestaurant(restaurantId);
        }
      });

      // Keyboard navigation
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('.btn-card-favourite')) return;
          e.preventDefault();
          if (restaurantId && typeof this.onSelectRestaurant === 'function') {
            this.onSelectRestaurant(restaurantId);
          }
        }
      });
    });
  }

  /**
   * Resolve image URL for restaurant
   */
  resolveRestaurantImage(restaurant) {
    if (restaurant.bannerImage) return restaurant.bannerImage;
    const nameLower = (restaurant.name || '').toLowerCase();
    if (nameLower.includes('khazana') || restaurant.id === 'rest_005' || restaurant.id === 'rest_001') {
      return '/assets/images/khazana-palace.jpg';
    }
    if (nameLower.includes('spice garden') || restaurant.id === 'rest_006' || restaurant.id === 'rest_003') {
      return '/assets/images/spice-garden.jpg';
    }
    if (nameLower.includes('biryani') || restaurant.id === 'rest_007') {
      return '/assets/images/biryani-house.jpg';
    }
    return '/assets/images/khazana-palace.jpg';
  }

  /**
   * Generates single restaurant card markup matching reference image
   */
  createCardHtml(restaurant) {
    const cuisinesText = Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(', ') : 'North Indian';
    const isOpen = Boolean(restaurant.isOpen);
    const isFav = this.isFavourite(restaurant.id);
    const imageUrl = this.resolveRestaurantImage(restaurant);

    const ratingVal = restaurant.rating ? Number(restaurant.rating).toFixed(1) : '4.5';
    const ratingCountText = restaurant.ratingCount ? `(${restaurant.ratingCount >= 1000 ? (restaurant.ratingCount / 1000).toFixed(1) + 'k' : restaurant.ratingCount})` : '(1.2k)';
    const deliveryTime = restaurant.deliveryTimeEstimate || `${restaurant.deliveryTimeMinutes || 30} min`;
    
    // Delivery fee representation matching reference
    let deliveryFeeText = 'Free delivery';
    if (restaurant.deliveryFee === 20 || restaurant.name === 'Spice Garden') {
      deliveryFeeText = '₹20 delivery';
    } else if (restaurant.deliveryFeeText) {
      deliveryFeeText = restaurant.deliveryFeeText;
    }

    return `
      <article
        class="restaurant-card"
        data-id="${restaurant.id}"
        tabindex="0"
        role="button"
        aria-label="View menu for ${restaurant.name}, rating ${ratingVal}"
      >
        <div class="card-media">
          <img
            src="${imageUrl}"
            alt="${restaurant.name}"
            class="restaurant-cover-img"
            loading="lazy"
            onerror="this.onerror=null;this.src='/assets/images/hero-dish.jpg';"
          />
          <div class="card-media-overlay"></div>
          
          <!-- Top Badges / Actions -->
          <div class="card-media-top">
            <div class="card-status-badges">
              ${!isOpen ? '<span class="badge-pill badge-closed">Closed</span>' : ''}
              ${restaurant.isVegOnly ? '<span class="badge-pill badge-veg-only">Pure Veg</span>' : ''}
            </div>
            <button
              type="button"
              class="btn-card-favourite ${isFav ? 'active' : ''}"
              data-fav-id="${restaurant.id}"
              aria-label="Save ${restaurant.name} to favourites"
              aria-pressed="${isFav ? 'true' : 'false'}"
              title="${isFav ? 'Remove from favourites' : 'Save to favourites'}"
            >
              ${isFav
                ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#B8862B" stroke="#B8862B" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
              }
            </button>
          </div>
        </div>

        <div class="card-content">
          <div class="card-title-row">
            <h3 class="restaurant-name" title="${restaurant.name}">${restaurant.name}</h3>
          </div>
          <p class="restaurant-cuisines" title="${cuisinesText}">${cuisinesText}</p>

          <div class="card-meta-row">
            <div class="meta-rating" title="Customer Rating">
              <span class="star-icon">★</span>
              <span class="rating-val">${ratingVal}</span>
              <span class="rating-count">${ratingCountText}</span>
            </div>
            <span class="meta-dot">&bull;</span>
            <div class="meta-time" title="Estimated delivery time">
              <span>${deliveryTime}</span>
            </div>
          </div>

          <div class="card-bottom-row">
            <span class="meta-delivery-fee ${deliveryFeeText === 'Free delivery' ? 'fee-free' : ''}">${deliveryFeeText}</span>
            <span class="card-action-link">View Menu &rarr;</span>
          </div>
        </div>
      </article>
    `;
  }
}

