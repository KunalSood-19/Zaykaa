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

  describe('6. Gold Leaf Design Tokens & Restaurant Portal Theme Integration (M2 Prompt 2.7)', () => {
    test('restaurant.css adopts Gold Leaf design tokens and variables', async () => {
      const fs = await import('node:fs/promises');
      const css = await fs.readFile(
        new URL('../../frontend/restaurant/restaurant.css', import.meta.url),
        'utf8'
      );

      // Core design token usage
      assert.ok(css.includes('var(--bg-primary)'), 'restaurant.css should use --bg-primary');
      assert.ok(css.includes('var(--bg-surface)'), 'restaurant.css should use --bg-surface');
      assert.ok(css.includes('var(--brand-primary)'), 'restaurant.css should use --brand-primary');
      assert.ok(css.includes('var(--text-main)'), 'restaurant.css should use --text-main');
      assert.ok(css.includes('var(--olive-primary)'), 'restaurant.css should use --olive-primary');
      assert.ok(css.includes('var(--border-gold)'), 'restaurant.css should use --border-gold');
      assert.ok(css.includes('.theme-toggle-btn'), 'restaurant.css should style theme toggle button');
    });

    test('restaurant index.html includes shared theme script and theme toggle button', async () => {
      const fs = await import('node:fs/promises');
      const html = await fs.readFile(
        new URL('../../frontend/restaurant/index.html', import.meta.url),
        'utf8'
      );

      // Shared theme preload script
      assert.ok(
        html.includes('/shared/js/theme.js'),
        'restaurant index.html must load shared theme.js'
      );
      // Theme toggle button
      assert.ok(
        html.includes('id="btn-theme-toggle"'),
        'restaurant index.html must have #btn-theme-toggle'
      );
      // Viewport meta
      assert.ok(
        html.includes('name="viewport"'),
        'restaurant index.html must have responsive viewport meta tag'
      );
      // Brand logo
      assert.ok(
        html.includes('zaykaa'),
        'restaurant index.html must have brand logo text'
      );
    });

    test('restaurant orders.js uses semantic status tokens without hardcoded neon colors', async () => {
      const fs = await import('node:fs/promises');
      const ordersJs = await fs.readFile(
        new URL('../../frontend/restaurant/js/orders.js', import.meta.url),
        'utf8'
      );

      // Verify semantic CSS variables are referenced
      assert.ok(
        ordersJs.includes('var(--status-ready-text)'),
        'orders.js must use var(--status-ready-text)'
      );
      assert.ok(
        ordersJs.includes('var(--status-delivered-text)'),
        'orders.js must use var(--status-delivered-text)'
      );
      assert.ok(
        ordersJs.includes('var(--status-cancelled-text)'),
        'orders.js must use var(--status-cancelled-text)'
      );
      // Verify hardcoded neon hex colors from old theme are eliminated
      assert.ok(!ordersJs.includes('#34d399'), 'orders.js should not contain hardcoded #34d399');
      assert.ok(!ordersJs.includes('#60a5fa'), 'orders.js should not contain hardcoded #60a5fa');
      assert.ok(!ordersJs.includes('#c084fc'), 'orders.js should not contain hardcoded #c084fc');
      assert.ok(!ordersJs.includes('#f87171'), 'orders.js should not contain hardcoded #f87171');
    });

    test('restaurant profile.js integrates 3-way theme preference switcher', async () => {
      const fs = await import('node:fs/promises');
      const profileJs = await fs.readFile(
        new URL('../../frontend/restaurant/js/profile.js', import.meta.url),
        'utf8'
      );

      assert.ok(
        profileJs.includes('theme-options-grid'),
        'profile.js must render theme-options-grid'
      );
      assert.ok(
        profileJs.includes("data-theme-val=\"light\""),
        'profile.js must support Light mode option'
      );
      assert.ok(
        profileJs.includes("data-theme-val=\"dark\""),
        'profile.js must support Dark mode option'
      );
      assert.ok(
        profileJs.includes("data-theme-val=\"system\""),
        'profile.js must support System default option'
      );
      assert.ok(
        profileJs.includes('setTheme'),
        'profile.js must call setTheme from shared theme manager'
      );
      assert.ok(
        profileJs.includes('zaykaa:theme-change'),
        'profile.js must synchronize on zaykaa:theme-change event'
      );
    });

    test('theme.js implements idempotent binding with data-themeBound guard (Prompt 2.7A)', async () => {
      const fs = await import('node:fs/promises');
      const themeJs = await fs.readFile(
        new URL('../../frontend/shared/js/theme.js', import.meta.url),
        'utf8'
      );

      assert.ok(
        themeJs.includes('bindThemeToggleButtons'),
        'theme.js must export bindThemeToggleButtons'
      );
      assert.ok(
        themeJs.includes('data-theme-bound') || themeJs.includes('themeBound'),
        'theme.js must guard against duplicate listener binding with themeBound'
      );
      assert.ok(
        themeJs.includes('window.ZaykaaTheme'),
        'theme.js must expose runtime helpers on window.ZaykaaTheme'
      );
    });

    test('restaurant.css elevates top-header above modal-backdrop (Prompt 2.7A)', async () => {
      const fs = await import('node:fs/promises');
      const css = await fs.readFile(
        new URL('../../frontend/restaurant/restaurant.css', import.meta.url),
        'utf8'
      );

      // Verify top-header has z-index: 1001 to prevent modal backdrop click interception
      assert.ok(
        css.includes('z-index: 1001;'),
        'restaurant.css top-header must have z-index: 1001'
      );
    });

    test('restaurant index.html includes theme toggle in auth modal header (Prompt 2.7A)', async () => {
      const fs = await import('node:fs/promises');
      const html = await fs.readFile(
        new URL('../../frontend/restaurant/index.html', import.meta.url),
        'utf8'
      );

      assert.ok(
        html.includes('id="btn-auth-theme-toggle"'),
        'restaurant index.html must include theme toggle in auth modal'
      );
    });
  });
});
