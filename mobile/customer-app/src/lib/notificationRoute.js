/**
 * Translates a server-supplied notification (or deep-link path) into a
 * navigation action consumable by `navigation.navigate(name, params)`.
 *
 * Server-side route conventions (see backend/src/services/notify.service.js):
 *   /request/:id                 → RequestTracking screen
 *   /wallet                      → WalletTab
 *   /wallet/transactions[/:id]   → TransactionHistory (optional ref)
 *   /orders                      → OrdersTab
 *   /utility/airtime|data|cable|electricity
 */

// IMPORTANT: tab names below MUST match MainTabNavigator's screen names
// (HomeTab/OrdersTab/WalletTab/CartTab). A mismatch produces a silent
// "screen not found" inside the tab navigator, which presents as the tap
// switching to MainTabs but never moving to the intended tab. Profile is no
// longer a tab - it's a stack screen above MainTabs, reachable via the home
// header avatar.
const ROUTE_MAP = [
  // /request/:id → tracking screen
  {
    re: /^\/?request\/([^/?#]+)/i,
    build: (m) => ({ name: 'RequestTracking', params: { requestId: m[1] } }),
  },
  // /wallet/transactions/:txId or /wallet/transactions
  {
    re: /^\/?wallet\/transactions(?:\/([^/?#]+))?/i,
    build: (m) => ({ name: 'TransactionHistory', params: m[1] ? { highlightRef: m[1] } : {} }),
  },
  // /wallet → wallet tab
  {
    re: /^\/?wallet\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'WalletTab' } }),
  },
  // /orders → orders tab
  {
    re: /^\/?orders\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'OrdersTab' } }),
  },
  // /utility/<kind>
  {
    re: /^\/?utility\/([a-z]+)/i,
    build: (m) => {
      const map = { airtime: 'Airtime', data: 'Data', cable: 'Cable', electricity: 'Electricity' };
      const screen = map[m[1].toLowerCase()];
      return screen ? { name: screen, params: {} } : null;
    },
  },
  // /home → main tabs
  {
    re: /^\/?home\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'HomeTab' } }),
  },
  // /notifications → Notification Center
  {
    re: /^\/?notifications\/?$/i,
    build: () => ({ name: 'NotificationCenter', params: {} }),
  },
  // /support/dispute/new/:requestId → CreateDispute (must precede /support/dispute/:id)
  {
    re: /^\/?support\/dispute\/new\/([^/?#]+)/i,
    build: (m) => ({ name: 'CreateDispute', params: { requestId: m[1] } }),
  },
  // /support/dispute/:id or /disputes/:id → DisputeDetail
  {
    re: /^\/?(?:support\/dispute|disputes?)\/([^/?#]+)/i,
    build: (m) => ({ name: 'SupportDisputeDetail', params: { disputeId: m[1] } }),
  },
  // /support/new → CreateTicket (must precede /support/:id)
  {
    re: /^\/?support\/new\/?$/i,
    build: () => ({ name: 'CreateSupportTicket', params: {} }),
  },
  // /support/ticket/:id or /support/:id → TicketDetail
  {
    re: /^\/?support\/(?:ticket\/)?([^/?#]+)/i,
    build: (m) => ({ name: 'SupportTicketDetail', params: { ticketId: m[1] } }),
  },
  // /support → My Tickets list
  {
    re: /^\/?support\/?$/i,
    build: () => ({ name: 'MyTickets', params: {} }),
  },
];

const matchRoute = (routePath) => {
  if (!routePath) return null;
  for (const rule of ROUTE_MAP) {
    const m = routePath.match(rule.re);
    if (m) {
      const out = rule.build(m);
      if (out) return out;
    }
  }
  return null;
};

/**
 * From a notification row OR plain route string, return a navigation action.
 * Fallback to MainTabs if nothing matches but a `requestId`/`transactionId`
 * is attached.
 */
export const routeToScreen = (n) => {
  if (!n) return null;
  // Direct route string.
  if (typeof n === 'string') return matchRoute(n);

  const route = n?.data?.route || n?.route;
  const matched = matchRoute(route);
  if (matched) return matched;

  if (n.requestId) {
    // REQUEST_MESSAGE notifications carry `data.channel` (CUSTOMER_RIDER or
    // CUSTOMER_MERCHANT - a customer is never on the rider<->merchant
    // thread) so RequestTrackingScreen can open straight into that thread.
    const chatChannel = n.data?.channel;
    return { name: 'RequestTracking', params: { requestId: n.requestId, ...(chatChannel ? { chatChannel } : {}) } };
  }
  if (n.transactionId) {
    return { name: 'TransactionHistory', params: { highlightRef: n.transactionId } };
  }
  return null;
};

/**
 * Parse a deep-link URL like `logistics://request/abc-123` into the same action
 * shape. Returns null if the URL doesn't carry a known path. The scheme-
 * agnostic regex below means legacy `customerapp://…` URLs (pre-rename) still
 * parse correctly if a stale notification lands.
 */
export const parseDeepLink = (url) => {
  if (!url) return null;
  try {
    // expo's Linking.parse returns { hostname, path, queryParams }.
    // We accept both `logistics://request/123` and `https://.../request/123`
    // by string-slicing the part after the scheme/host.
    const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\/(?:[^/]+)?/i, '');
    return matchRoute(stripped);
  } catch (_) {
    return null;
  }
};

