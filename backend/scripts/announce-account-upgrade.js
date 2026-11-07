/**
 * announce-account-upgrade.js
 *
 * One-shot product announcement: tells users their wallet top-up account
 * number has changed and hands them their NEW number + bank (the active
 * provider's account, i.e. the Paystack DVA). Copy deliberately never names
 * the payment providers - from the user's point of view they simply have one
 * (now newer) personal funding account.
 *
 * Each recipient gets BOTH channels, exactly as a normal system notice would:
 *   1. In-app notification + push  via notifyService.pushAndSocket (Notification
 *      Center row, socket badge, native FCM push, web VAPID push). Taps
 *      deep-link to the Wallet tab. type=SYSTEM passes the preference gate.
 *   2. Email via emailService.sendEmail.
 *
 * BLAST eligibility: non-admin, not deleted, status ACTIVE/PENDING, AND a
 * provisioned paystackAccountNumber (a "new account number" to hand the user).
 * Users without an account are excluded on purpose. Re-runs are idempotent -
 * anyone already holding a SYSTEM notification with this exact title is skipped.
 *
 * TEST mode: --test --emails a@b.com,c@d.com notifies+emails exactly that list
 * (bypasses the eligibility filter, so it can target accounts that don't have a
 * number yet for copy review).
 *
 * Usage (from backend/, with live .env):
 *   ENV_FILE=/path/to/.env node scripts/announce-account-upgrade.js --test \
 *     --emails customer@,rider@ --dry-run      # report
 *   ENV_FILE=/path/to/.env node scripts/announce-account-upgrade.js --test \
 *     --emails customer@,rider@                # live test
 *   ENV_FILE=/path/to/.env node scripts/announce-account-upgrade.js --blast --yes
 *   LIMIT=10 DELAY_MS=250 node scripts/announce-account-upgrade.js --blast --yes
 */

const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '..', '.env') });

const { prisma } = require('../src/config/database');
const notifyService = require('../src/services/notify.service');
const emailService = require('../src/services/email.service');

const ARGS = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--emails=')));
const emailsFlag = process.argv.find((a) => a.startsWith('--emails='));

const DRY_RUN = ARGS.has('--dry-run');
const BLAST = ARGS.has('--blast');
const TEST = ARGS.has('--test') || !!emailsFlag;
const CONFIRM = ARGS.has('--yes');

const TEST_EMAILS = emailsFlag
  ? emailsFlag.split('=')[1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : [];

const LIMIT = Number(process.env.LIMIT) || Infinity;
const DELAY_MS = Number(process.env.DELAY_MS) || 50;

const TITLE = 'Your wallet got a new account number';
const EMAIL_SUBJECT = 'Your new wallet account number is ready';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padEnd(5);

const bodyFor = ({ accountNumber, bankName }) => {
  if (accountNumber) {
    return `You now have a brand-new wallet top-up account: ${accountNumber} (${bankName}). ` +
      `Open Wallet → Fund to see it anytime. If you recently sent money to your old number, ` +
      `everything's been handled — no need to worry. Update any saved details when you get a chance.`;
  }
  return `We've upgraded wallet funding, so your personal top-up account has a brand-new number and bank. ` +
    `Open Wallet → Fund to see them anytime. If you recently sent money to your old number, ` +
    `everything's been handled — no need to worry.`;
};

const emailHtmlFor = ({ firstName, accountNumber, bankName }) => {
  const numberBlock = accountNumber
    ? `
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0 24px;">
        <div style="background-color:#f0f5ff;border-radius:8px;padding:20px 24px;text-align:center;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">Your new top-up account</div>
          <div style="font-size:22px;font-weight:700;color:#1a1a2e;letter-spacing:1px;">${accountNumber}</div>
          <div style="font-size:14px;color:#374151;margin-top:4px;">${bankName || ''}</div>
        </div>
      </td></tr></table>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:480px;background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <tr>
                <td style="padding:32px 32px 0;">
                  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;line-height:1.3;">Your wallet just got an upgrade 💙</h1>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                    Hi ${firstName || 'there'}, we've been working behind the scenes to make wallet top-ups
                    smoother and more reliable. As part of that upgrade, your personal top-up account now
                    has a brand-new number and bank.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px;">
                  ${numberBlock}
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                    The new number above is yours to use for wallet top-ups. Open the app and head to
                    <strong>Wallet → Fund</strong> to see it anytime, and update it wherever you've saved
                    your top-up details so nothing ever gets delayed.
                  </p>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                    And if you recently sent money to your old number — no worries at all. Everything's
                    already been handled on our side.
                  </p>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                    Your balance, transaction history, and the rest of your experience stay exactly the
                    same. Questions? Just reply here — we're happy to help.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px;color:#6b7280;font-size:13px;line-height:1.6;">
                  Warm regards,<br>The Logistics Platform Team
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const textFor = ({ firstName, accountNumber, bankName }) => {
  const start = `Hi ${firstName || 'there'},\n\nWe've been working behind the scenes to make wallet top-ups smoother and more reliable. As part of that upgrade, your personal top-up account now has a brand-new number and bank.`;
  const numberLine = accountNumber ? `\n\nYour new top-up account:\n${accountNumber}${bankName ? ` (${bankName})` : ''}\n\nUse this number for wallet top-ups.` : '';
  const rest = `\n\nOpen the app and head to Wallet → Fund to see it anytime, and update it wherever you've saved your top-up details so nothing ever gets delayed. If you recently sent money to your old number, no worries at all — everything's already been handled on our side.\n\nYour balance, transaction history, and the rest of your experience stay exactly the same. Questions? Just reply — we're happy to help.\n\nWarm regards,\nThe Logistics Platform Team`;
  return start + numberLine + rest;
};

const notifyInstance = async ({ user }) => {
  const { paystackAccountNumber, paystackAccountBank } = user.wallet || {};
  const accountNumber = paystackAccountNumber || null;
  const bankName = paystackAccountBank || 'Wema Bank';
  const body = bodyFor({ accountNumber, bankName });

  await notifyService.pushAndSocket(user.id, {
    type: 'SYSTEM',
    title: TITLE,
    body,
    data: { route: '/wallet' },
  });
};

const emailInstance = async ({ user }) => {
  const { paystackAccountNumber, paystackAccountBank } = user.wallet || {};
  const accountNumber = paystackAccountNumber || null;
  const bankName = paystackAccountBank || 'Wema Bank';

  await emailService.sendEmail({
    to: user.email,
    subject: EMAIL_SUBJECT,
    html: emailHtmlFor({ firstName: user.firstName, accountNumber, bankName }),
    text: textFor({ firstName: user.firstName, accountNumber, bankName }),
  });
};

const alreadyNotified = async (userId) => {
  const row = await prisma.notification.findFirst({
    where: { userId, type: 'SYSTEM', title: TITLE },
    select: { id: true },
  });
  return !!row;
};

const sendOne = async ({ user, label }) => {
  let notifyOk = false;
  let emailOk = false;
  try { await notifyInstance({ user }); notifyOk = true; } catch (e) { console.error(`  ! notify FAILED for ${user.email}: ${e.message}`); }
  try { await emailInstance({ user }); emailOk = true; } catch (e) { console.error(`  ! email FAILED for ${user.email}: ${e.message}`); }
  console.log(`  ${label} ${user.email} notify=${notifyOk ? 'OK' : 'FAIL'} email=${emailOk ? 'OK' : 'FAIL'}`);
};

const describe = ({ user }) =>
  `${user.id} ${user.email} (${user.role}${user.wallet?.paystackAccountNumber ? `, acct ${user.wallet.paystackAccountNumber}` : ', no account'})`;

async function main() {
  if (DRY_RUN) console.log('DRY RUN - nothing will be sent\n');

  if (TEST) {
    if (TEST_EMAILS.length === 0) {
      console.error('TEST mode requires --emails=a@b.com,c@d.com');
      process.exit(1);
    }
    if (BLAST) {
      console.error('Use either --test or --blast, not both');
      process.exit(1);
    }
    console.log(`TEST mode for ${TEST_EMAILS.length} email(s): ${TEST_EMAILS.join(', ')}`);
    const users = await prisma.user.findMany({
      where: { email: { in: TEST_EMAILS } },
      select: { id: true, email: true, firstName: true, role: true, wallet: { select: { paystackAccountNumber: true, paystackAccountBank: true } } },
    });
    const found = new Set(users.map((u) => u.email.toLowerCase()));
    const missing = TEST_EMAILS.filter((e) => !found.has(e));
    if (missing.length) console.log(`\nNOT FOUND (skipped): ${missing.join(', ')}`);
    console.log('');
    for (const user of users) {
      console.log(`  target: ${describe({ user })}`);
      if (!DRY_RUN) { await sendOne({ user, label: 'sent  ' }); await sleep(DELAY_MS); }
    }
  } else if (BLAST) {
    if (!CONFIRM) {
      console.error('BLAST requires --yes to proceed.');
      process.exit(1);
    }
    console.log('BLAST mode\n');
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        deletedAt: null,
        status: { in: ['ACTIVE', 'PENDING'] },
        wallet: { is: { paystackAccountNumber: { not: null } } },
      },
      select: { id: true, email: true, firstName: true, role: true, wallet: { select: { paystackAccountNumber: true, paystackAccountBank: true } } },
      orderBy: { id: 'asc' },
      take: LIMIT === Infinity ? undefined : LIMIT,
    });

    let sent = 0; let skipped = 0; let failed = 0;
    for (const user of users) {
      if (await alreadyNotified(user.id)) {
        skipped += 1;
        console.log(`  skip  ${pad(user.email)} - already notified`);
        continue;
      }
      console.log(`  target ${pad(user.email)} → ${describe({ user })}`);
      if (DRY_RUN) continue;
      try {
        await notifyInstance({ user });
        await emailInstance({ user });
        sent += 1;
      } catch (e) {
        failed += 1;
        console.error(`  ! FAILED ${user.email}: ${e.message}`);
      }
      await sleep(DELAY_MS);
    }

    console.log(`\nBLAST summary: ${users.length} eligible, sent=${sent}, already-skipped=${skipped}, failed=${failed}`);
  } else {
    console.error('Usage: --test --emails=a@b.com,c@d.com  |  --blast --yes   (add --dry-run to report only)');
    process.exit(1);
  }
}

main()
  .then(() => { console.log('\nDone.'); return prisma.$disconnect(); })
  .catch((e) => { console.error('Fatal:', e); return prisma.$disconnect(); });