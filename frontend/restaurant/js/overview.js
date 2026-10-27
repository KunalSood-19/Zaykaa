import { formatPaise, formatDateTime, getStatusBadgeClass, escapeHtml } from '../../shared/js/utils.js';

/**
 * Calculates and updates the metrics overview from actual restaurant orders.
 *
 * @param {Array<object>} orders
 * @param {object} restaurant
 */
export function renderOverviewMetrics(orders = [], restaurant = null) {
  const totalCount = orders.length;
  const newCount = orders.filter((o) => o.status === 'Placed').length;
  const kitchenCount = orders.filter((o) => o.status === 'Accepted' || o.status === 'Preparing').length;
  const readyCount = orders.filter((o) => o.status === 'Ready for Pickup').length;
  const deliveredOrders = orders.filter((o) => o.status === 'Delivered');
  const deliveredCount = deliveredOrders.length;

  // Calculate revenue strictly from valid completed (Delivered) orders
  const totalRevenuePaise = deliveredOrders.reduce((sum, o) => {
    const total = o.pricing?.total || 0;
    return sum + (typeof total === 'number' ? total : 0);
  }, 0);

  // Update DOM metric values
  const elTotal = document.getElementById('metric-total-orders');
  const elNew = document.getElementById('metric-new-orders');
  const elKitchen = document.getElementById('metric-kitchen-orders');
  const elReady = document.getElementById('metric-ready-orders');
  const elDelivered = document.getElementById('metric-delivered-orders');
  const elRevenue = document.getElementById('metric-revenue');

  if (elTotal) elTotal.textContent = totalCount;
  if (elNew) elNew.textContent = newCount;
  if (elKitchen) elKitchen.textContent = kitchenCount;
  if (elReady) elReady.textContent = readyCount;
  if (elDelivered) elDelivered.textContent = deliveredCount;
  if (elRevenue) elRevenue.textContent = formatPaise(totalRevenuePaise);

  // Update nav badge count for new orders
  const navNewBadge = document.getElementById('nav-orders-count');
  if (navNewBadge) {
    if (newCount > 0) {
      navNewBadge.textContent = newCount;
      navNewBadge.style.display = 'inline-block';
    } else {
      navNewBadge.style.display = 'none';
    }
  }

  // Update restaurant summary card on overview
  const elRestName = document.getElementById('overview-rest-name');
  const elRestDesc = document.getElementById('overview-rest-desc');
  const elRestStatus = document.getElementById('overview-rest-status');

  if (elRestName && restaurant) {
    elRestName.textContent = restaurant.name;
  }
  if (elRestDesc && restaurant) {
    elRestDesc.textContent = restaurant.description || 'Welcome to your restaurant management console.';
  }
  if (elRestStatus && restaurant) {
    const isOpen = restaurant.isOpen !== false;
    elRestStatus.className = `status-indicator ${isOpen ? 'open' : 'closed'}`;
    elRestStatus.innerHTML = `
      <span class="indicator-dot"></span>
      ${isOpen ? 'Open for Orders' : 'Currently Closed'}
    `;
  }

  // Render recent orders table
  renderRecentOrders(orders.slice(0, 5));
}

/**
 * Renders the recent orders snippet table on the overview section.
 *
 * @param {Array<object>} recentOrders
 */
function renderRecentOrders(recentOrders) {
  const container = document.getElementById('recent-orders-list');
  if (!container) return;

  if (recentOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <span class="empty-state-icon">📋</span>
        <div class="empty-state-title">No orders yet</div>
        <div class="empty-state-desc">New customer orders will appear here automatically in real time.</div>
      </div>
    `;
    return;
  }

  const rows = recentOrders.map((order) => {
    const itemsText = (order.items || [])
      .map((i) => `${escapeHtml(i.name)} &times; ${i.quantity}`)
      .join(', ');

    return `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="padding: 0.85rem 1rem; font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem;">
          ${escapeHtml(order.id.slice(0, 14))}...
        </td>
        <td style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
          ${formatDateTime(order.timestamps?.createdAt || order.createdAt)}
        </td>
        <td style="padding: 0.85rem 1rem; font-weight: 600;">
          ${escapeHtml(order.customerName || 'Customer')}
        </td>
        <td style="padding: 0.85rem 1rem; color: var(--text-secondary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${itemsText}
        </td>
        <td style="padding: 0.85rem 1rem;">
          <span class="badge ${getStatusBadgeClass(order.status)}">
            <span class="badge-dot"></span>
            ${escapeHtml(order.status)}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--text-main);">
          ${formatPaise(order.pricing?.total || 0)}
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-medium); color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">
            <th style="padding: 0.75rem 1rem;">Order ID</th>
            <th style="padding: 0.75rem 1rem;">Time</th>
            <th style="padding: 0.75rem 1rem;">Customer</th>
            <th style="padding: 0.75rem 1rem;">Items</th>
            <th style="padding: 0.75rem 1rem;">Status</th>
            <th style="padding: 0.75rem 1rem;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}
