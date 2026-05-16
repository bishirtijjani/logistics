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
  {
    re: /^\/?wallet\/transactions(?:\/([^/?#]+))?/i,
    build: (m) => ({ name: 'Transactions', params: m[1] ? { highlightRef: m[1] } : {} }),
  },
  {
    re: /^\/?wallet\/?$/i,
    build: () => ({ name: 'MainTabs', params: { screen: 'WalletTab' } }),
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
    return { name: 'TripCockpit', params: { requestId: n.requestId } };
  }
  if (n.transactionId) {
    return { name: 'Transactions', params: { highlightRef: n.transactionId } };
  }
  return null;
};

/**
 * Parse a deep-link URL like `riderapp://offer/abc-123` into the same action shape.
 */
export const parseDeepLink = (url) => {
  if (!url) return null;
  try {
    const stripped = url.replace(/^[a-z][a-z0-9+.-]*:\/\/(?:[^/]+)?/i, '');
    return matchRoute(stripped);
  } catch (_) {
    return null;
  }
};
