/**
 * Formats integer paise into a formatted rupee string (e.g., 28000 -> ₹280.00).
 *
 * @param {number|string} paise
 * @returns {string}
 */
export function formatPaise(paise) {
  const numeric = typeof paise === 'number' ? paise : parseInt(paise, 10);
  if (isNaN(numeric) || numeric < 0) {
    return '₹0.00';
  }
  const rupees = (numeric / 100).toFixed(2);
  return `₹${Number(rupees).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Converts a rupee input value (e.g., 280 or "280.50") into integer paise (28050).
 *
 * @param {number|string} rupees
 * @returns {number}
 */
export function rupeesToPaise(rupees) {
  const numeric = typeof rupees === 'number' ? rupees : parseFloat(rupees);
  if (isNaN(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}

/**
 * Escapes unsafe characters in strings to prevent Cross-Site Scripting (XSS).
 *
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats an ISO 8601 timestamp string into a friendly localized display.
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Computes human-friendly relative time (e.g., "Just now", "5m ago", "2h ago").
 *
 * @param {string} isoString
 * @returns {string}
 */
export function timeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * Returns CSS badge class for order status.
 *
 * @param {string} status
 * @returns {string}
 */
export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Placed':
      return 'badge-placed';
    case 'Accepted':
      return 'badge-accepted';
    case 'Preparing':
      return 'badge-preparing';
    case 'Ready for Pickup':
      return 'badge-ready';
    case 'Picked Up':
    case 'Out for Delivery':
      return 'badge-transit';
    case 'Delivered':
      return 'badge-delivered';
    case 'Rejected':
      return 'badge-rejected';
    case 'Cancelled':
      return 'badge-cancelled';
    default:
      return 'badge-placed';
  }
}

/**
 * Displays a toast notification on screen.
 *
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=3500]
 */
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" style="background:none;border:none;color:inherit;cursor:pointer;opacity:0.8;">&times;</button>
  `;

  const closeBtn = toast.querySelector('button');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  };

  closeBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}
