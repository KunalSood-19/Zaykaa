import {
  formatPaise,
  formatDateTime,
  timeAgo,
  escapeHtml,
} from '../../shared/js/utils.js';

/**
 * Renders the dashboard overview section with real metrics and activity.
 *
 * @param {object} dashboardData
 * @param {object} user
 * @param {(viewId: string) => void} navigateFn
 */
export function renderOverview(dashboardData = {}, user = {}, navigateFn = () => {}) {
  const partner = dashboardData.partner || {};
  const activeOrder = dashboardData.activeOrder || null;
  const availableOrders = dashboardData.availableOrders || [];

  // Update greeting and titles
  const titleEl = document.getElementById('overview-partner-title');
  if (titleEl) {
    titleEl.textContent = `Welcome, ${user.name || 'Partner'}!`;
  }

  // Duty badge
  const dutyBadge = document.getElementById('overview-duty-badge');
  if (dutyBadge) {
    if (partner.isAvailable) {
      dutyBadge.className = 'badge badge-accepted';
      dutyBadge.textContent = 'Duty: Online';
    } else {
      dutyBadge.className = 'badge badge-placed';
      dutyBadge.textContent = 'Duty: Offline';
    }
  }

  // Stats cards
  const totalDeliveriesEl = document.getElementById('stat-total-deliveries');
  if (totalDeliveriesEl) {
    totalDeliveriesEl.textContent = String(partner.totalDeliveries || 0);
  }

  const availableOrdersEl = document.getElementById('stat-available-orders');
  if (availableOrdersEl) {
    availableOrdersEl.textContent = String(availableOrders.length || 0);
  }

  const vehicleEl = document.getElementById('stat-vehicle-type');
  if (vehicleEl) {
    vehicleEl.textContent = partner.vehicleType || 'Not Set';
  }

  // Active delivery banner snippet
  const activeSnippet = document.getElementById('overview-active-snippet');
  const activeStatusEl = document.getElementById('overview-active-status');
  const activeDetailsEl = document.getElementById('overview-active-details');

  if (activeSnippet && activeStatusEl && activeDetailsEl) {
    if (activeOrder) {
      activeStatusEl.className = 'badge badge-transit';
      activeStatusEl.textContent = activeOrder.status;

      const pickupName = activeOrder.restaurantName || 'Restaurant';
      const dropoffStreet = activeOrder.deliveryAddress?.street || 'Customer Address';

      activeDetailsEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem;">
          <div style="font-weight: 600; color: var(--text-main);">
            Order: <code style="font-family: var(--font-mono);">${escapeHtml(activeOrder.id.slice(0, 16))}...</code>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
            <span>🏬 <strong>${escapeHtml(pickupName)}</strong></span>
            <span>&rarr;</span>
            <span>📍 <strong>${escapeHtml(dropoffStreet)}</strong></span>
          </div>
          <div style="margin-top: 0.5rem;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-overview-go-active">
              View Active Order
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-overview-go-active')?.addEventListener('click', () => {
        navigateFn('active');
      });
    } else {
      activeStatusEl.className = 'badge badge-placed';
      activeStatusEl.textContent = 'Idle (No Active Order)';

      activeDetailsEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span>
            ${partner.isAvailable
              ? 'You are online and ready to accept orders from the pool.'
              : 'You are currently offline. Switch your duty to Online to view and claim delivery orders.'}
          </span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-overview-browse-pool">
            Browse Pool (${availableOrders.length})
          </button>
        </div>
      `;

      document.getElementById('btn-overview-browse-pool')?.addEventListener('click', () => {
        navigateFn('available');
      });
    }
  }
}

/**
 * Renders recent deliveries list on the overview page.
 *
 * @param {Array<object>} deliveries
 * @param {(viewId: string) => void} navigateFn
 */
export function renderRecentDeliveries(deliveries = [], navigateFn = () => {}) {
  const container = document.getElementById('overview-recent-deliveries');
  if (!container) return;

  if (!deliveries || deliveries.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <span class="empty-state-icon">🛵</span>
        <div class="empty-state-title">No completed deliveries yet</div>
        <div class="empty-state-desc">Your fulfilled deliveries will appear here with delivery timestamps.</div>
      </div>
    `;
    return;
  }

  const recent = deliveries.slice(0, 5);
  container.innerHTML = `
    <div class="history-table-container">
      <table class="history-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Restaurant</th>
            <th>Delivered Time</th>
            <th>Destination</th>
            <th>Fee Earned</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map((order) => `
            <tr>
              <td><code style="font-family: var(--font-mono); font-weight: 700;">${escapeHtml(order.id.slice(0, 14))}...</code></td>
              <td style="font-weight: 600;">${escapeHtml(order.restaurantName || 'Restaurant')}</td>
              <td>${formatDateTime(order.timestamps?.updatedAt || order.updatedAt)}</td>
              <td>${escapeHtml(order.deliveryAddress?.city || 'Local')}</td>
              <td style="font-weight: 700; color: #34d399;">${formatPaise(order.pricing?.deliveryFee || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
