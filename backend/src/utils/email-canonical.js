/**
 * Canonicalize an email so the common "same mailbox, different-looking address"
 * tricks collapse to ONE value for multi-account detection. This is deliberately
 * used only to FLAG duplicates for review, never to block signup (two different
 * people can legitimately share a canonical form only on Gmail dot/plus tricks,
 * which is exactly the abuse signal we want to surface).
 *
 * Handles:
 *   - case + surrounding whitespace           Olam@ / OLAM@  → olam@
 *   - plus-tags (Gmail + most providers)       olam+promo@    → olam@
 *   - googlemail alias                         olam@googlemail.com → olam@gmail.com
 *   - Gmail dots (ignored by Gmail)            o.l.a.m@gmail.com   → olam@gmail.com
 *
 * It CANNOT link genuinely different mailboxes (e.g. `foobar` vs `foobar1`,
 * `colemiller` vs `colemill`) - those need the funding-account / phone / device
 * signals, not email normalization. See fundWallet's funding-ring flag.
 *
 * MUST stay in lock-step with the SQL backfill in the migration
 * 20260718140000_add_email_canonical_review_flag so stored + computed values match.
 */
const canonicalizeEmail = (raw) => {
  const e = String(raw || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at <= 0 || at === e.length - 1) return e; // not a normal address; leave as-is
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split('+')[0]; // drop +tag
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, ''); // Gmail ignores dots
  return `${local}@${domain}`;
};

module.exports = { canonicalizeEmail };
