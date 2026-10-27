import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPaise,
  rupeesToPaise,
  escapeHtml,
  getStatusBadgeClass,
  timeAgo,
} from '../../frontend/shared/js/utils.js';
import { OrderManager } from '../../frontend/restaurant/js/orders.js';

describe('Frontend Restaurant Portal Unit Tests (M2 Prompt 2.5)', () => {
  describe('1. Price Formatting & Paise Conversion (utils.js)', () => {
    test('formatPaise converts integer paise to Indian Rupee formatted string', () => {
      assert.equal(formatPaise(28000), '₹280.00');
      assert.equal(formatPaise(0), '₹0.00');
      assert.equal(formatPaise(100), '₹1.00');
      assert.equal(formatPaise(1000000), '₹10,000.00');
      assert.equal(formatPaise(74550), '₹745.50');
      assert.equal(formatPaise('5000'), '₹50.00');
    });

    test('formatPaise safely handles invalid or negative values', () => {
      assert.equal(formatPaise(-100), '₹0.00');
      assert.equal(formatPaise(NaN), '₹0.00');
      assert.equal(formatPaise('invalid'), '₹0.00');
      assert.equal(formatPaise(null), '₹0.00');
      assert.equal(formatPaise(undefined), '₹0.00');
    });

    test('rupeesToPaise accurately converts decimal/integer rupee inputs to integer paise', () => {
      assert.equal(rupeesToPaise(280), 28000);
      assert.equal(rupeesToPaise(280.5), 28050);
      assert.equal(rupeesToPaise('280.50'), 28050);
      assert.equal(rupeesToPaise('0.99'), 99);
      assert.equal(rupeesToPaise(0), 0);
      assert.equal(rupeesToPaise('49.99'), 4999);
    });

    test('rupeesToPaise discards invalid or negative numbers safely', () => {
      assert.equal(rupeesToPaise(-50), 0);
      assert.equal(rupeesToPaise('abc'), 0);
      assert.equal(rupeesToPaise(null), 0);
      assert.equal(rupeesToPaise(undefined), 0);
    });
  });

  describe('2. XSS Prevention & Safe Rendering (escapeHtml)', () => {
    test('escapeHtml escapes dangerous HTML characters', () => {
      const malicious = '<script>alert("XSS")</script>';
      const safe = escapeHtml(malicious);
      assert.ok(!safe.includes('<script>'));
      assert.equal(safe, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    test('escapeHtml handles single quotes and ampersands', () => {
      const input = "Chef's Special & Desserts";
      assert.equal(escapeHtml(input), 'Chef&#39;s Special &amp; Desserts');
    });

    test('escapeHtml handles non-string or falsy values safely', () => {
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
      assert.equal(escapeHtml(12345), '12345');
    });
  });

  describe('3. Status-to-Badge & Status Mapping (getStatusBadgeClass)', () => {
    test('returns designated CSS class for every canonical status', () => {
      assert.equal(getStatusBadgeClass('Placed'), 'badge-placed');
      assert.equal(getStatusBadgeClass('Accepted'), 'badge-accepted');
      assert.equal(getStatusBadgeClass('Preparing'), 'badge-preparing');
      assert.equal(getStatusBadgeClass('Ready for Pickup'), 'badge-ready');
      assert.equal(getStatusBadgeClass('Picked Up'), 'badge-transit');
      assert.equal(getStatusBadgeClass('Out for Delivery'), 'badge-transit');
      assert.equal(getStatusBadgeClass('Delivered'), 'badge-delivered');
      assert.equal(getStatusBadgeClass('Rejected'), 'badge-rejected');
      assert.equal(getStatusBadgeClass('Cancelled'), 'badge-cancelled');
      assert.equal(getStatusBadgeClass('Unknown'), 'badge-placed');
    });
  });

  describe('4. Relative Time Calculation (timeAgo)', () => {
    test('computes relative time correctly', () => {
      const now = new Date();
      assert.equal(timeAgo(now.toISOString()), 'Just now');

      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      assert.equal(timeAgo(fiveMinsAgo.toISOString()), '5m ago');

      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      assert.equal(timeAgo(twoHoursAgo.toISOString()), '2h ago');

      const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
      assert.equal(timeAgo(twoDaysAgo.toISOString()), '2d ago');
    });
  });

  describe('5. Status-to-Action Mapping (OrderManager.prototype.renderActionButtons)', () => {
    const dummyOrderManager = Object.create(OrderManager.prototype);

    test('Placed order allows Accept and Reject actions', () => {
      const html = dummyOrderManager.renderActionButtons({ id: 'ord_1', status: 'Placed' });
      assert.ok(html.includes('data-target-status="Accepted"'));
      assert.ok(html.includes('data-target-status="Rejected"'));
      assert.ok(html.includes('Accept'));
      assert.ok(html.includes('Reject'));
    });

    test('Accepted order allows Start Cooking (Preparing) action', () => {
      const html = dummyOrderManager.renderActionButtons({ id: 'ord_2', status: 'Accepted' });
      assert.ok(html.includes('data-target-status="Preparing"'));
      assert.ok(html.includes('Start Cooking'));
      assert.ok(!html.includes('Reject')); // Reject disallowed after acceptance
    });

    test('Preparing order allows Mark Ready action', () => {
      const html = dummyOrderManager.renderActionButtons({ id: 'ord_3', status: 'Preparing' });
      assert.ok(html.includes('data-target-status="Ready for Pickup"'));
      assert.ok(html.includes('Mark Ready'));
    });

    test('Ready for Pickup and In Transit states are read-only for restaurant owners', () => {
      const htmlReady = dummyOrderManager.renderActionButtons({ id: 'ord_4', status: 'Ready for Pickup' });
      assert.ok(htmlReady.includes('Awaiting Courier'));
      assert.ok(!htmlReady.includes('<button'));

      const htmlTransit = dummyOrderManager.renderActionButtons({ id: 'ord_5', status: 'Out for Delivery' });
      assert.ok(htmlTransit.includes('In Transit'));
      assert.ok(!htmlTransit.includes('<button'));
    });

    test('Terminal orders (Delivered, Cancelled, Rejected) show read-only status tags without mutation buttons', () => {
      for (const status of ['Delivered', 'Cancelled', 'Rejected']) {
        const html = dummyOrderManager.renderActionButtons({ id: 'ord_6', status });
        assert.ok(!html.includes('<button'));
        assert.ok(html.includes(status === 'Delivered' ? 'Completed' : status));
      }
    });
  });
});
