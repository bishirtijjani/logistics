/**
 * Translates a server-supplied notification (or deep-link path) into a
 * navigation action consumable by `navigation.navigate(name, params)`.
 *
 * Rider route conventions:
 *   /offer/:id                   → JobOffer (if still valid) else JobMissed
 *   /trip/:id                    → TripCockpit
 *   /home                        → Home tab
 *   /earnings                    → EarningsDashboard
 *   /wallet                      → WalletHome
 *   /wallet/withdraw             → WithdrawScreen
 *   /wallet/transactions[/:id]   → TransactionsScreen (optional ref)
 *   /notifications               → NotificationsCenter
 *   /support[/ticket/:id]        → SupportHome / TicketDetail
 *   /support/dispute/new/:reqId  → CreateDispute
 *   /support/dispute/:id         → DisputeDetail
 *   /kyc                         → KycStatusScreen
 *   /performance                 → PerformanceScreen
 */

// IMPORTANT: tab names below MUST match MainTabNavigator's screen names
// (HomeTab/TripTab/EarningsTab/WalletTab/MeTab).
const ROUTE_MAP = [
  {
    re: /^\/?offer\/([^/?#]+)/i,
    build: (m) => ({ name: 'JobOffer', params: { requestId: m[1] } }),
  },
  {
    re: /^\/?trip\/([^/?#]+)/i,
    build: (m) => ({ name: 'TripCockpit', params: { requestId: m[1] } }),
  },
  {
    re: /^\/?wallet\/withdraw\/?$/i,
    build: () => ({ name: 'Withdraw', params: {} }),
  },
  // Specific /wallet/transactions/:txId route - opens TransactionDetail.
  {
    re: /^\/?wallet\/transactions\/([^/?#]+)/i,
    build: (m) => ({ name: 'TransactionDetail', params: { transactionId: m[1] } }),
  },
  {
    re: /^\/?wallet\/transactions\/?$/i,
    build: () => ({ name: 'Transactions', params: {} }),
  },
  {
    re: /^\/?wallet\/beneficiaries\/?$/i,
    build: () => ({ name: 'Beneficiaries', params: {} }),
  },
  {
    re: /^\/?wallet\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'WalletTab' } }),
  },
  {
    re: /^\/?earnings\/breakdown\/?$/i,
    build: () => ({ name: 'EarningsBreakdown', params: {} }),
  },
  {
    re: /^\/?earnings\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'EarningsTab' } }),
  },
  {
    re: /^\/?home\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'HomeTab' } }),
  },
  {
    re: /^\/?notifications\/?$/i,
    build: () => ({ name: 'NotificationsCenter', params: {} }),
  },
  {
    re: /^\/?kyc\/?$/i,
    build: () => ({ name: 'KycStatus', params: {} }),
  },
  {
    re: /^\/?performance\/?$/i,
    build: () => ({ name: 'Performance', params: {} }),
  },
  {
    re: /^\/?support\/dispute\/new\/([^/?#]+)/i,
    build: (m) => ({ name: 'CreateDispute', params: { requestId: m[1] } }),
  },
  {
    re: /^\/?(?:support\/dispute|disputes?)\/([^/?#]+)/i,
    build: (m) => ({ name: 'DisputeDetail', params: { disputeId: m[1] } }),
  },
  {
    re: /^\/?support\/new\/?$/i,
    build: () => ({ name: 'CreateTicket', params: {} }),
  },
  {
    re: /^\/?support\/(?:ticket\/)?([^/?#]+)/i,
    build: (m) => ({ name: 'TicketDetail', params: { ticketId: m[1] } }),
  },
  {
    re: /^\/?support\/?$/i,
    build: () => ({ name: 'SupportHome', params: {} }),
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
 */
export const routeToScreen = (n) => {
  if (!n) return null;
  if (typeof n === 'string') return matchRoute(n);

  const route = n?.data?.route || n?.route;
  const matched = matchRoute(route);
  if (matched) return matched;

  if (n.requestId) {
    // REQUEST_MESSAGE notifications carry `data.channel` (CUSTOMER_RIDER or
    // RIDER_MERCHANT - a rider is never on the customer<->merchant thread)
    // so TripCockpitScreen can open straight into that thread on arrival.
    const chatChannel = n.data?.channel;
    return { name: 'TripCockpit', params: { requestId: n.requestId, ...(chatChannel ? { chatChannel } : {}) } };
  }
  if (n.transactionId) {
    return { name: 'Transactions', params: { highlightRef: n.transactionId } };
  }
  return null;
};

/**
 * Parse a deep-link URL like `iprime://offer/abc-123` into the same action
 * shape. The scheme-agnostic regex below still accepts legacy `riderapp://`
 * URLs so notifications pushed before the v1 rename keep working.
 */
export const parseDeepLink = (url) => {
  if (!url) return null;
  try {
    // http(s) URLs carry a hostname between `://` and the first `/` -
    // strip both. Custom schemes like `iprime://trip/abc` have no host;
    // strip only the scheme so the first path segment ("trip") isn't
    // mistaken for a hostname and discarded.
    const isHttp = /^https?:\/\//i.test(url);
    const stripped = isHttp
      ? url.replace(/^https?:\/\/[^/]+/i, '')
      : url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    return matchRoute(stripped);
  } catch (_) {
    return null;
  }
};
