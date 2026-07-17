/**
 * Shared constants used across the entire backend.
 *
 * Import from here instead of hardcoding magic strings.
 */

// Redis key prefixes - all Redis keys MUST use these prefixes
const REDIS_KEYS = {
  RIDER_LOCATION: "rider:location:", // rider:location:{riderId}
  RIDER_AVAILABILITY: "rider:availability:", // rider:availability:{riderId}
  ACTIVE_REQUEST: "request:active:", // request:active:{requestId}
  OTP: "otp:", // otp:{phone}
  PENDING_REG: "pending_reg:", // pending_reg:{email}
  OTP_COOLDOWN: "otp_cooldown:", // otp_cooldown:{email} - 60s between resends
  SESSION: "session:", // session:{userId}
  RATE_LIMIT: "ratelimit:", // ratelimit:{ip}:{endpoint}
  // Phase 4 - logistics
  RIDER_GEO_INDEX: "riders:geo", // GEOADD/GEOSEARCH key for available riders
  RIDER_HEARTBEAT: "rider:heartbeat:", // rider:heartbeat:{userId} - liveness of a rider in the dispatch pool
  RIDER_LOC_DB_THROTTLE: "rider:locdbwrite:", // rider:locdbwrite:{userId} - throttles DB persistence of GPS pings
  REQUEST_ROUTE: "request:route:", // request:route:{requestId} - 30s cache for /route
  REQUEST_ETA_LAST: "request:eta:last:", // last pushed ETA + position {requestId}
  RIDER_OFFER_LOCK: "rider:offer:", // rider:offer:{requestId} - set during a ring round
  // Phase 7 - utility/VTU
  VTU_DATA_PLANS: "vtu:data-plans:", // vtu:data-plans:{networkId|all} - 1h cache
  VTU_DISCOS: "vtu:discos", // 1h cache of DISCO list
  VTU_NETWORKS: "vtu:networks:", // vtu:networks:{type|all} - 1h cache of network catalogue
};

// Redis TTLs (in seconds)
const REDIS_TTL = {
  RIDER_LOCATION: 30, // Stale after 30s (updates every ~3s)
  RIDER_AVAILABILITY: 3600, // 1 hour
  // A rider streaming GPS refreshes this every ~3s. If it lapses the rider is
  // no longer reachable and the reconcile sweep prunes them from the geo index
  // and flips their sticky DB availability=ONLINE back to OFFLINE. Generous
  // enough to survive a few dropped pings / a brief reconnect.
  RIDER_HEARTBEAT: 90, // 90s
  RIDER_LOC_DB_THROTTLE: 20, // persist a GPS ping to the DB at most every 20s per rider
  ACTIVE_REQUEST: 86400, // 24 hours
  OTP: 600, // 10 minutes
  PENDING_REG: 600, // 10 minutes (same as OTP)
  OTP_COOLDOWN: 60, // 60 seconds between resend requests
  SESSION: 604800, // 7 days
  // Phase 4 - logistics
  REQUEST_ROUTE: 30, // 30s - short enough to track real movement, cheap on Maps quota
  REQUEST_ETA_LAST: 120, // 2 min - cleared when delivery completes
  // Phase 7 - utility/VTU
  VTU_DATA_PLANS: 3600, // 1 hour - data plans rarely change
  VTU_DISCOS: 3600, // 1 hour
  VTU_NETWORKS: 3600, // 1 hour - admin-edited but read-heavy
};

// Phase 7 - Nigerian network prefixes for client/server auto-detect.
// Source: NCC numbering plan (operators occasionally add codes; review yearly).
const NETWORK_PREFIXES = {
  MTN:       ['0703','0706','0803','0806','0810','0813','0814','0816','0903','0906','0913','0916','0704','0707'],
  GLO:       ['0705','0805','0807','0811','0815','0905','0915'],
  AIRTEL:    ['0701','0708','0802','0808','0812','0902','0907','0901','0904','0912'],
  '9MOBILE': ['0809','0817','0818','0908','0909'],
};

// BilalSadaSub provider IDs - fallback only. The live providerNetworkId is
// resolved from the admin-managed VtuNetwork table at request time, so a
// provider renumber needs no code change; this constant just keeps the static
// network-detection helper aligned. NB: BilalSada drops SMILE and reorders
// GLO/AIRTEL/9MOBILE vs AlRahuz (MTN=1, AIRTEL=2, GLO=3, 9MOBILE=4).
const NETWORK_IDS = { MTN: 1, AIRTEL: 2, GLO: 3, '9MOBILE': 4 };

const NETWORKS = [
  { id: NETWORK_IDS.MTN,       name: 'MTN' },
  { id: NETWORK_IDS.GLO,       name: 'GLO' },
  { id: NETWORK_IDS['9MOBILE'], name: '9MOBILE' },
  { id: NETWORK_IDS.AIRTEL,    name: 'AIRTEL' },
];

const detectNetworkFromPhone = (raw) => {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\D/g, '');
  // Normalise 234XXXXXXXXXX → 0XXXXXXXXXX
  const phone = cleaned.startsWith('234') ? '0' + cleaned.slice(3) : cleaned;
  if (phone.length < 4) return null;
  const prefix = phone.slice(0, 4);
  for (const [name, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) {
      return { name, id: NETWORK_IDS[name], prefix };
    }
  }
  return null;
};

// OTP settings
const OTP = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 3,
};

// Transaction PIN
const PIN = {
  LENGTH: 6,
  MAX_ATTEMPTS: 3,
  LOCKOUT_MINUTES: 30,
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Rider matching - defaults if PlatformSetting overrides are unavailable.
// Production reads `delivery.broadcastRadiusRings`,
// `delivery.broadcastRingTimeoutSec`, and `delivery.autoCancelUnmatchedMs`
// from PlatformSetting; these are the conservative fallbacks.
const RIDER_MATCHING = {
  RADIUS_RINGS_KM: [5, 10, 15],
  RING_TIMEOUT_SECONDS: 60,
  MAX_RIDERS_PER_RING: 10,
  AUTO_CANCEL_BUFFER_MS: 2000, // small grace after final ring expires
};

module.exports = {
  REDIS_KEYS,
  REDIS_TTL,
  OTP,
  PIN,
  PAGINATION,
  RIDER_MATCHING,
  NETWORK_PREFIXES,
  NETWORK_IDS,
  NETWORKS,
  detectNetworkFromPhone,
};
