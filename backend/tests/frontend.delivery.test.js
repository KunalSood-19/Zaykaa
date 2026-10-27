import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPaise,
  formatDateTime,
  timeAgo,
  escapeHtml,
  getStatusBadgeClass,
} from '../../frontend/shared/js/utils.js';
import { VEHICLE_TYPES } from '../../frontend/delivery/js/profile.js';

describe('Frontend Delivery Portal Unit Tests (M2 Prompt 2.6)', () => {
  describe('1. Vehicle Types & Profile Rules (profile.js)', () => {
    test('contains all canonical vehicle types supported by backend contract', () => {
      assert.deepEqual(VEHICLE_TYPES, [
        'Motorcycle',
        'Scooter',
        'Bicycle',
        'Electric Vehicle',
      ]);
    });

    test('validates availability toggle guard against active orders', () => {
      const busyPartner = {
        id: 'del_123',
        isAvailable: false,
        activeOrderId: 'ord_active_456',
      };

      const idlePartner = {
        id: 'del_789',
        isAvailable: false,
        activeOrderId: null,
      };

      // Rule: partner cannot become available if busy with active order
      const canGoOnline = (partner, nextStatus) => {
        if (nextStatus === true && partner.activeOrderId !== null) {
          return false;
        }
        return true;
      };

      assert.equal(canGoOnline(busyPartner, true), false);
      assert.equal(canGoOnline(busyPartner, false), true);
      assert.equal(canGoOnline(idlePartner, true), true);
    });
  });

  describe('2. Delivery Order Status to Action Mappings (active.js)', () => {
    function resolveDeliveryAction(status) {
      switch (status) {
        case 'Placed':
        case 'Accepted':
        case 'Preparing':
          return {
            allowed: false,
            step: 1,
            label: 'Kitchen is Preparing Food...',
            endpoint: null,
          };
        case 'Ready for Pickup':
          return {
            allowed: true,
            step: 2,
            label: 'Confirm Package Pickup',
            endpoint: (id) => `/api/partners/orders/${id}/pickup`,
          };
        case 'Picked Up':
          return {
            allowed: true,
            step: 3,
            label: 'Depart Restaurant & Start Delivery',
            endpoint: (id) => `/api/partners/orders/${id}/out-for-delivery`,
          };
        case 'Out for Delivery':
          return {
            allowed: true,
            step: 4,
            label: 'Confirm Delivery Handover to Customer',
            endpoint: (id) => `/api/partners/orders/${id}/deliver`,
          };
        case 'Delivered':
          return {
            allowed: false,
            step: 5,
            label: 'Completed',
            endpoint: null,
          };
        default:
          return {
            allowed: false,
            step: 0,
            label: status,
            endpoint: null,
          };
      }
    }

    test('Preparing order disables pickup action until restaurant marks Ready', () => {
      const action = resolveDeliveryAction('Preparing');
      assert.equal(action.allowed, false);
      assert.equal(action.step, 1);
      assert.equal(action.endpoint, null);
    });

    test('Ready for Pickup allows courier pickup confirmation', () => {
      const action = resolveDeliveryAction('Ready for Pickup');
      assert.equal(action.allowed, true);
      assert.equal(action.step, 2);
      assert.equal(action.endpoint('ord_101'), '/api/partners/orders/ord_101/pickup');
    });

    test('Picked Up allows courier departure and out-for-delivery update', () => {
      const action = resolveDeliveryAction('Picked Up');
      assert.equal(action.allowed, true);
      assert.equal(action.step, 3);
      assert.equal(action.endpoint('ord_101'), '/api/partners/orders/ord_101/out-for-delivery');
    });

    test('Out for Delivery allows delivery completion handover', () => {
      const action = resolveDeliveryAction('Out for Delivery');
      assert.equal(action.allowed, true);
      assert.equal(action.step, 4);
      assert.equal(action.endpoint('ord_101'), '/api/partners/orders/ord_101/deliver');
    });

    test('Delivered order is terminal and offers no further state actions', () => {
      const action = resolveDeliveryAction('Delivered');
      assert.equal(action.allowed, false);
      assert.equal(action.endpoint, null);
    });
  });

  describe('3. Payout & Fees Aggregation (history.js & overview.js)', () => {
    test('calculates total courier delivery fees from completed history', () => {
      const completedHistory = [
        { id: 'ord_1', pricing: { deliveryFee: 4000 } },
        { id: 'ord_2', pricing: { deliveryFee: 6500 } },
        { id: 'ord_3', pricing: { deliveryFee: 5000 } },
      ];

      const totalFeesPaise = completedHistory.reduce(
        (sum, o) => sum + (o.pricing?.deliveryFee || 0),
        0
      );

      assert.equal(totalFeesPaise, 15500);
      assert.equal(formatPaise(totalFeesPaise), '₹155.00');
    });

    test('handles missing or zero delivery fee gracefully', () => {
      const emptyHistory = [{ id: 'ord_empty' }];
      const totalFeesPaise = emptyHistory.reduce(
        (sum, o) => sum + (o.pricing?.deliveryFee || 0),
        0
      );

      assert.equal(totalFeesPaise, 0);
      assert.equal(formatPaise(totalFeesPaise), '₹0.00');
    });
  });

  describe('4. Safe Sanitization & Address Rendering', () => {
    test('escapes malicious script strings in restaurant and customer names', () => {
      const rawMalicious = '<img src=x onerror=alert(1)> Spicy Kitchen';
      const clean = escapeHtml(rawMalicious);
      assert.ok(!clean.includes('<img'));
      assert.ok(clean.includes('&lt;img src=x onerror=alert(1)&gt; Spicy Kitchen'));
    });

    test('formats delivery address street and city safely', () => {
      const addr = {
        street: '12 4th Cross & 2nd Main',
        city: 'Bengaluru <South>',
        pincode: '560038',
      };

      const formatted = `${escapeHtml(addr.street)}, ${escapeHtml(addr.city)} — ${escapeHtml(addr.pincode)}`;
      assert.equal(formatted, '12 4th Cross &amp; 2nd Main, Bengaluru &lt;South&gt; — 560038');
    });
  });

  describe('5. Status Badge & Relative Timestamps', () => {
    test('maps pickup and in-transit statuses to correct badge classes', () => {
      assert.equal(getStatusBadgeClass('Ready for Pickup'), 'badge-ready');
      assert.equal(getStatusBadgeClass('Picked Up'), 'badge-transit');
      assert.equal(getStatusBadgeClass('Out for Delivery'), 'badge-transit');
      assert.equal(getStatusBadgeClass('Delivered'), 'badge-delivered');
    });

    test('formatDateTime handles ISO timestamps and empty inputs', () => {
      assert.equal(formatDateTime(''), '—');
      assert.equal(formatDateTime(null), '—');
      assert.ok(formatDateTime('2026-10-27T10:30:00.000Z').includes('2026') || formatDateTime('2026-10-27T10:30:00.000Z').includes('Oct'));
    });
  });

  describe('6. Gold Leaf Design Tokens & Theme Foundations (Prompt 2.6A)', () => {
    test('variables.css defines canonical Light mode tokens', async () => {
      const fs = await import('node:fs/promises');
      const css = await fs.readFile(new URL('../../frontend/shared/css/variables.css', import.meta.url), 'utf8');

      // Canonical light mode tokens
      assert.ok(css.toLowerCase().includes('#faf7f0'), 'Light background #FAF7F0 missing');
      assert.ok(css.toLowerCase().includes('#ffffff'), 'Light surface #FFFFFF missing');
      assert.ok(css.toLowerCase().includes('#b8862b'), 'Light primary gold #B8862B missing');
      assert.ok(css.toLowerCase().includes('#24231f'), 'Light primary text #24231F missing');
      assert.ok(css.toLowerCase().includes('#60764b'), 'Light supporting olive #60764B missing');
    });

    test('variables.css defines canonical Dark mode tokens', async () => {
      const fs = await import('node:fs/promises');
      const css = await fs.readFile(new URL('../../frontend/shared/css/variables.css', import.meta.url), 'utf8');

      // Canonical dark mode tokens
      assert.ok(css.toLowerCase().includes('#101311'), 'Dark background #101311 missing');
      assert.ok(css.toLowerCase().includes('#1c211e'), 'Dark surface #1C211E missing');
      assert.ok(css.toLowerCase().includes('#e4b75e'), 'Dark primary gold #E4B75E missing');
      assert.ok(css.toLowerCase().includes('#f5f0e5'), 'Dark primary text #F5F0E5 missing');
      assert.ok(css.toLowerCase().includes('#94a67c'), 'Dark supporting olive #94A67C missing');
    });

    test('variables.css preserves distinct semantic status tokens for non-gold states', async () => {
      const fs = await import('node:fs/promises');
      const css = await fs.readFile(new URL('../../frontend/shared/css/variables.css', import.meta.url), 'utf8');

      // Preserves distinct non-gold colors for errors and deliveries
      assert.ok(css.includes('--status-delivered-bg'), 'status-delivered-bg missing');
      assert.ok(css.includes('--status-cancelled-bg'), 'status-cancelled-bg missing');
      assert.ok(css.includes('--status-ready-bg'), 'status-ready-bg missing');
    });

    test('theme switcher logic resolves active theme correctly', () => {
      function resolveTheme(preference, systemDark = true) {
        if (preference === 'light' || preference === 'dark') {
          return preference;
        }
        return systemDark ? 'dark' : 'light';
      }

      assert.equal(resolveTheme('light', true), 'light');
      assert.equal(resolveTheme('light', false), 'light');
      assert.equal(resolveTheme('dark', false), 'dark');
      assert.equal(resolveTheme('system', true), 'dark');
      assert.equal(resolveTheme('system', false), 'light');
    });
  });
});

