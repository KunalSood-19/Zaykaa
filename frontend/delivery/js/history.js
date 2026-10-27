import api from '../../shared/js/api.js';
import {
  formatPaise,
  formatDateTime,
  escapeHtml,
  showToast,
} from '../../shared/js/utils.js';

export class HistoryManager {
  /**
   * @param {() => object|null} getPartnerFn
   */
  constructor(getPartnerFn) {
    this.getPartner = getPartnerFn;
    this.history = [];

    this.bindEvents();
  }

  bindEvents() {
    const btnRefresh = document.getElementById('btn-refresh-history');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadHistory(true));
    }
  }

  /**
   * Loads completed deliveries from GET /api/partners/orders/history
   *
   * @param {boolean} [showToastFeedback=false]
   * @returns {Promise<Array<object>>}
   */
  async loadHistory(showToastFeedback = false) {
    const partner = this.getPartner();
    const container = document.getElementById('history-container');

    if (!partner) {
      this.history = [];
      this.render();
      return [];
    }

    try {
      const orders = await api.get('/api/partners/orders/history');
      this.history = Array.isArray(orders) ? orders : [];
      this.render();

      if (showToastFeedback) {
        showToast('Delivery history updated', 'info');
      }

      return this.history;
    } catch (err) {
      if (showToastFeedback) {
        showToast(err.message || 'Failed to load delivery history', 'error');
      }
      if (container && !this.history.length) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">⚠️</span>
            <div class="empty-state-title">Unable to Load History</div>
            <div class="empty-state-desc">${escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" id="btn-retry-history">Try Again</button>
          </div>
        `;
        document.getElementById('btn-retry-history')?.addEventListener('click', () => this.loadHistory(true));
      }
      return [];
    }
  }

  /**
   * Renders completed delivery records.
   */
  render() {
    const container = document.getElementById('history-container');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1.5rem; border: 1px dashed var(--border-medium);">
          <span class="empty-state-icon">📜</span>
          <div class="empty-state-title">No Delivery History</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0 auto;">
            You have not completed any deliveries yet. As soon as you deliver an order to a customer, it will be cataloged here.
          </div>
        </div>
      `;
      return;
    }

    const totalFeesPaise = this.history.reduce(
      (sum, o) => sum + (o.pricing?.deliveryFee || 0),
      0
    );

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <!-- Payout Summary Banner -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Completed Deliveries</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main);">${this.history.length} Orders</div>
          </div>
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Total Delivery Fees Earned</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #34d399;">${formatPaise(totalFeesPaise)}</div>
          </div>
        </div>

        <!-- History Records Table -->
        <div class="history-table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Delivered Time</th>
                <th>Restaurant</th>
                <th>Destination</th>
                <th>Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${this.history.map((order) => {
                const dropoff = order.deliveryAddress || {};
                return `
                  <tr>
                    <td>
                      <code style="font-family: var(--font-mono); font-weight: 700; color: var(--text-main);">
                        ${escapeHtml(order.id.slice(0, 16))}...
                      </code>
                    </td>
                    <td>${formatDateTime(order.timestamps?.updatedAt || order.updatedAt)}</td>
                    <td style="font-weight: 600;">${escapeHtml(order.restaurantName || 'Restaurant')}</td>
                    <td>${escapeHtml(dropoff.street || '')}, ${escapeHtml(dropoff.city || '')}</td>
                    <td style="font-weight: 700; color: #34d399;">${formatPaise(order.pricing?.deliveryFee || 0)}</td>
                    <td>
                      <span class="badge badge-delivered">Delivered</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
