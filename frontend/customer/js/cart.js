/**
 * Zaykaa Customer Cart State & Persistence Manager
 * Handles multi-restaurant conflict detection, localStorage persistence, and price calculations
 */

const STORAGE_KEY = 'zaykaa_customer_cart';

export class Cart {
  constructor() {
    this.listeners = new Set();
    this.cart = this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.items)) {
          return {
            restaurantId: parsed.restaurantId || null,
            restaurantName: parsed.restaurantName || null,
            items: parsed.items
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse cart from localStorage:', e);
    }

    return {
      restaurantId: null,
      restaurantName: null,
      items: []
    };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      // Immediately call with current state
      listener(this.getCart(), this.getTotals());
    }
    return () => this.listeners.delete(listener);
  }

  notify() {
    const cartState = this.getCart();
    const totals = this.getTotals();
    for (const listener of this.listeners) {
      try {
        listener(cartState, totals);
      } catch (e) {
        console.error('Error in cart listener:', e);
      }
    }
  }

  getCart() {
    return {
      restaurantId: this.cart.restaurantId,
      restaurantName: this.cart.restaurantName,
      items: this.cart.items.map((item) => ({ ...item }))
    };
  }

  getState() {
    const totals = this.getTotals();
    return {
      ...this.getCart(),
      itemCount: this.getItemCount(),
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      tax: totals.tax,
      total: totals.total
    };
  }

  getItemCount() {
    return this.cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  getItemQuantity(itemId) {
    const found = this.cart.items.find((i) => String(i.itemId) === String(itemId));
    return found ? found.quantity : 0;
  }

  getTotals() {
    const subtotal = this.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = subtotal > 0 ? 40 : 0; // Flat ₹40 delivery fee for Phase CE-1
    const tax = Math.round(subtotal * 0.05); // 5% GST
    const total = subtotal + deliveryFee + tax;

    return {
      subtotal,
      deliveryFee,
      tax,
      total
    };
  }

  /**
   * Add menu item to cart. Detects and guards against multi-restaurant mixing.
   */
  addItem(item, restaurant) {
    if (!item || !restaurant) return { success: false };

    // Multi-restaurant conflict check
    if (this.cart.restaurantId && this.cart.items.length > 0 && String(this.cart.restaurantId) !== String(restaurant.id)) {
      return {
        conflict: true,
        currentRestaurant: this.cart.restaurantName || 'another restaurant',
        newRestaurant: restaurant.name || 'this restaurant',
        item,
        restaurant
      };
    }

    // Set restaurant if starting new cart
    this.cart.restaurantId = restaurant.id;
    this.cart.restaurantName = restaurant.name;

    const existingIndex = this.cart.items.findIndex((i) => String(i.itemId) === String(item.itemId));
    if (existingIndex > -1) {
      const currentQty = this.cart.items[existingIndex].quantity || 0;
      if (currentQty < 20) {
        this.cart.items[existingIndex].quantity = currentQty + 1;
      }
    } else {
      this.cart.items.push({
        itemId: item.itemId,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: 1,
        isVeg: Boolean(item.isVeg)
      });
    }

    this.save();
    return { success: true };
  }

  /**
   * Update quantity of an item (+1 or -1). Removes item if quantity reaches 0.
   */
  updateQuantity(itemId, delta) {
    const existingIndex = this.cart.items.findIndex((i) => String(i.itemId) === String(itemId));
    if (existingIndex === -1) return;

    const newQty = (this.cart.items[existingIndex].quantity || 0) + delta;

    if (newQty <= 0) {
      this.cart.items.splice(existingIndex, 1);
    } else {
      this.cart.items[existingIndex].quantity = Math.min(20, newQty);
    }

    // If cart is now empty, clear restaurant
    if (this.cart.items.length === 0) {
      this.cart.restaurantId = null;
      this.cart.restaurantName = null;
    }

    this.save();
  }

  /**
   * Remove item completely from cart
   */
  removeItem(itemId) {
    this.cart.items = this.cart.items.filter((i) => String(i.itemId) !== String(itemId));
    if (this.cart.items.length === 0) {
      this.cart.restaurantId = null;
      this.cart.restaurantName = null;
    }
    this.save();
  }

  /**
   * User confirmed discarding existing cart to add an item from a new restaurant
   */
  clearAndAdd(item, restaurant) {
    this.cart.items = [];
    this.cart.restaurantId = restaurant.id;
    this.cart.restaurantName = restaurant.name;
    this.cart.items.push({
      itemId: item.itemId,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: 1,
      isVeg: Boolean(item.isVeg)
    });
    this.save();
    return { success: true };
  }

  /**
   * Clear all items in cart
   */
  clearCart() {
    this.cart.items = [];
    this.cart.restaurantId = null;
    this.cart.restaurantName = null;
    this.save();
  }
}

export const cart = new Cart();