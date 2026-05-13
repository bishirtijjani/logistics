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
// longer a tab — it's a stack screen above MainTabs, reachable via the home
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
    return { name: 'RequestTracking', params: { requestId: n.requestId } };
  }
  if (n.transactionId) {
    return { name: 'TransactionHistory', params: { highlightRef: n.transactionId } };
  }
  return null;
};

/**
 * Parse a deep-link URL like `customerapp://request/abc-123` into the same
 * action shape. Returns null if the URL doesn't carry a known path.
 */
export const parseDeepLink = (url) => {
  if (!url) return null;
  try {
    // expo's Linking.parse returns { hostname, path, queryParams }.
    // We accept both `customerapp://request/123` and `https://.../request/123`
    // by string-slicing the part after the scheme/host.
    const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\/(?:[^/]+)?/i, '');
    return matchRoute(stripped);
  } catch (_) {
    return null;
  }
};

