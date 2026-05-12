/**
 * Nigerian phone-prefix → network detection.
 *
 * Per Phase 7: prefixes change rarely, so we keep this client-side as a
 * constant table to avoid a round trip on every keystroke. Source of truth
 * is also mirrored on the backend (backend/src/utils/constants.js); update
 * both when the NCC numbering plan changes.
 */

export const NETWORK_PREFIXES = {
  MTN:       ['0703','0706','0803','0806','0810','0813','0814','0816','0903','0906','0913','0916','0704','0707'],
  GLO:       ['0705','0805','0807','0811','0815','0905','0915'],
  AIRTEL:    ['0701','0708','0802','0808','0812','0902','0907','0901','0904','0912'],
  '9MOBILE': ['0809','0817','0818','0908','0909'],
};

export const NETWORK_IDS = { MTN: 1, GLO: 2, '9MOBILE': 3, AIRTEL: 4, SMILE: 5 };

/**
 * Returns { name, id, prefix } or null if no match.
 * Accepts both '080...' and '23480...' / '+23480...' shapes.
 */
export function detectNetworkFromPhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\D/g, '');
  const phone = cleaned.startsWith('234') ? '0' + cleaned.slice(3) : cleaned;
  if (phone.length < 4) return null;
  const prefix = phone.slice(0, 4);
  for (const [name, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) {
      return { name, id: NETWORK_IDS[name], prefix };
    }
  }
  return null;
}
