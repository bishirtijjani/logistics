/**
 * Email service - sends transactional emails via Gmail SMTP.
 *
 * Uses Nodemailer with Gmail App Password.
 * Templates are defined here for consistency across the platform.
 */

const nodemailer = require('nodemailer');
const { config } = require('../config');
const { logger } = require('../utils/logger');

let transporter = null;

/**
 * Get or create the email transporter.
 */
const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Send a raw email.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });

    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error('Email send failed', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send OTP verification email.
 */
const sendOtpEmail = async (email, otp) => {
  const html = `
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
              <!-- Header -->
              <tr>
                <td style="padding:32px 32px 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">iPrime</h1>
                  <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Katsina State</p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#374151;">Your verification code is:</p>
                  <div style="background-color:#f0f4ff;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a2e;">${otp}</span>
                  </div>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">This code expires in <strong>10 minutes</strong>.</p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">If you didn't request this code, ignore this email.</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:0 32px 32px;text-align:center;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    &copy; ${new Date().getFullYear()} iPrime. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} - Your iPrime verification code`,
    html,
    text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
  });
};

/**
 * Send welcome email after registration.
 */
const sendWelcomeEmail = async (email, firstName) => {
  const html = `
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
                <td style="padding:32px 32px 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">Welcome to iPrime!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${firstName},</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
                    Your account has been created successfully. You can now:
                  </p>
                  <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#6b7280;">
                    <li style="margin-bottom:8px;">Fund your wallet via bank transfer</li>
                    <li style="margin-bottom:8px;">Buy airtime, data, and pay electricity bills</li>
                    <li style="margin-bottom:8px;">Send & receive money instantly</li>
                    <li>Request deliveries across Katsina State</li>
                  </ul>
                  <p style="margin:0;font-size:14px;color:#6b7280;">Set up your transaction PIN to start using financial features.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px;text-align:center;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    &copy; ${new Date().getFullYear()} iPrime
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Welcome to iPrime, ${firstName}!`,
    html,
    text: `Hi ${firstName}, welcome to iPrime! Your account is ready.`,
  });
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async (email, otp) => {
  const html = `
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
                <td style="padding:32px 32px 0;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">Password Reset</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;color:#374151;">
                    You requested a password reset. Use this code:
                  </p>
                  <div style="background-color:#fef3f2;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#dc2626;">${otp}</span>
                  </div>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">This code expires in <strong>10 minutes</strong>.</p>
                  <p style="margin:0;font-size:14px;color:#ef4444;font-weight:600;">If you didn't request this, change your password immediately.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px;text-align:center;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    &copy; ${new Date().getFullYear()} iPrime
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} - Password reset code`,
    html,
    text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
  });
};

// ============================================================
// Merchant Notification Emails
// ============================================================

const emailBase = (content) => `
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
        <table width="100%" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#EA580C,#C2410C);padding:28px 32px;border-radius:16px 16px 0 0;">
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.3px;">iPrime</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Merchant Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} iPrime. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Questions? Contact <a href="mailto:support@iprime.ng" style="color:#EA580C;text-decoration:none;">support@iprime.ng</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const btnPrimary = (text) =>
  `<div style="text-align:center;margin:24px 0;">
    <a href="#" style="display:inline-block;background:#EA580C;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;">${text}</a>
  </div>`;

const infoBox = (color, bg, items) =>
  `<div style="background-color:${bg};border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
    ${items.map(([label, value]) => `<p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong style="color:#111827;">${label}:</strong> ${value}</p>`).join('')}
  </div>`;

/**
 * Merchant application approved - welcome email with next steps.
 */
const sendMerchantApprovedEmail = async (email, merchantName) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#10b981;font-weight:700;">Application Approved!</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Congratulations, <strong>${merchantName}</strong>!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Your merchant application on iPrime has been <strong style="color:#10b981;">approved</strong>.
      You can now log in to your merchant dashboard and start listing your products.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#166534;">Next Steps</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
        <li>Log in to your merchant dashboard</li>
        <li>Complete your store profile with a logo and cover image</li>
        <li>Add your bank account for withdrawals</li>
        <li>Upload your first products or menu items</li>
        <li>Set your operating hours</li>
      </ul>
    </div>
    ${btnPrimary('Go to Merchant Dashboard')}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Welcome aboard! We're excited to have you on the platform.</p>
  `);

  return sendEmail({
    to: email,
    subject: `Your iPrime merchant application is approved - ${merchantName}`,
    html,
    text: `Congratulations! Your merchant application for ${merchantName} has been approved. Log in to your dashboard to get started.`,
  });
};

/**
 * Merchant application rejected - reason + how to reapply.
 */
const sendMerchantRejectedEmail = async (email, merchantName, reason) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#ef4444;font-weight:700;">Application Not Approved</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${merchantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      After reviewing your application, we were unable to approve your merchant account at this time.
    </p>
    ${infoBox('#ef4444', '#fef2f2', [['Reason', reason || 'Your application did not meet our current requirements.']])}
    <div style="background:#fafafa;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#374151;">What you can do</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#6b7280;line-height:2;">
        <li>Review the reason above and address the issue</li>
        <li>Re-submit your application with the required corrections</li>
        <li>Contact our support team if you need clarification</li>
      </ul>
    </div>
    <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">
      If you believe this decision was made in error, please contact us at
      <a href="mailto:support@iprime.ng" style="color:#EA580C;">support@iprime.ng</a>.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Update on your iPrime merchant application`,
    html,
    text: `Dear ${merchantName}, your merchant application was not approved. Reason: ${reason}. Please contact support@iprime.ng for more information.`,
  });
};

/**
 * Merchant suspended - reason + contact info.
 */
const sendMerchantSuspendedEmail = async (email, merchantName, reason) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#f59e0b;font-weight:700;">Account Suspended</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${merchantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Your merchant account has been <strong style="color:#f59e0b;">temporarily suspended</strong>.
      During this period, your store will not be visible to customers and withdrawals are paused.
    </p>
    ${infoBox('#f59e0b', '#fffbeb', [['Suspension Reason', reason || 'Account review in progress.']])}
    <p style="margin:20px 0;font-size:14px;color:#6b7280;line-height:1.6;">
      To appeal this decision or get more information, please contact our merchant support team at
      <a href="mailto:support@iprime.ng" style="color:#EA580C;">support@iprime.ng</a>
      or call <strong>+234-800-000-0000</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;">We aim to resolve all suspensions as quickly as possible.</p>
  `);

  return sendEmail({
    to: email,
    subject: `Important: Your iPrime merchant account has been suspended`,
    html,
    text: `Dear ${merchantName}, your merchant account has been suspended. Reason: ${reason}. Contact support@iprime.ng to appeal.`,
  });
};

/**
 * Merchant unsuspended - access restored.
 */
const sendMerchantUnsuspendedEmail = async (email, merchantName) => {
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#10b981;font-weight:700;">Account Restored</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${merchantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Great news! The suspension on your merchant account has been <strong style="color:#10b981;">lifted</strong>.
      Your store is now live again and customers can place orders.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">
        Your wallet has been unlocked and withdrawal functionality has been restored.
        You can log in to your dashboard to resume normal operations.
      </p>
    </div>
    ${btnPrimary('Go to Merchant Dashboard')}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Thank you for your patience.</p>
  `);

  return sendEmail({
    to: email,
    subject: `Your iPrime merchant account has been restored - ${merchantName}`,
    html,
    text: `Dear ${merchantName}, your merchant account suspension has been lifted. You can now log in and resume operations.`,
  });
};

/**
 * Withdrawal approved - payout amount + reference.
 */
const sendWithdrawalApprovedEmail = async (email, merchantName, amount, reference) => {
  const formattedAmount = `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#10b981;font-weight:700;">Withdrawal Approved</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${merchantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Your withdrawal request has been <strong style="color:#10b981;">approved</strong> and payment has been initiated to your registered bank account.
    </p>
    ${infoBox('#10b981', '#f0fdf4', [
      ['Amount', `<strong style="font-size:18px;">${formattedAmount}</strong>`],
      ['Reference', `<code style="font-family:monospace;background:#e5e7eb;padding:2px 6px;border-radius:4px;">${reference}</code>`],
      ['Status', 'Processing - funds typically arrive within 1–3 business hours'],
    ])}
    <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">
      If you don't receive the funds within 24 hours, please contact us at
      <a href="mailto:support@iprime.ng" style="color:#EA580C;">support@iprime.ng</a>
      quoting your reference number.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Withdrawal of ${formattedAmount} approved - iPrime`,
    html,
    text: `Dear ${merchantName}, your withdrawal of ${formattedAmount} has been approved. Reference: ${reference}.`,
  });
};

/**
 * Withdrawal rejected - reason + funds returned to wallet.
 */
const sendWithdrawalRejectedEmail = async (email, merchantName, amount, reason) => {
  const formattedAmount = `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#ef4444;font-weight:700;">Withdrawal Not Processed</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${merchantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      We were unable to process your withdrawal request of <strong>${formattedAmount}</strong>.
    </p>
    ${infoBox('#ef4444', '#fef2f2', [['Reason', reason || 'Unable to verify bank account details.']])}
    <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">Your funds are safe</p>
      <p style="margin:6px 0 0;font-size:14px;color:#374151;">
        The amount of <strong>${formattedAmount}</strong> has been returned to your merchant wallet and is available for withdrawal.
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      To retry, log in to your dashboard and submit a new withdrawal request. If you need assistance,
      contact <a href="mailto:support@iprime.ng" style="color:#EA580C;">support@iprime.ng</a>.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Withdrawal request could not be processed - iPrime`,
    html,
    text: `Dear ${merchantName}, your withdrawal of ${formattedAmount} could not be processed. Reason: ${reason}. The funds have been returned to your wallet.`,
  });
};

/**
 * Commission rate changed - notifies merchant of new rate.
 */
const sendCommissionChangedEmail = async (email, merchantName, previousRate, newRate) => {
  const direction = newRate < previousRate ? 'decreased' : 'increased';
  const color = newRate < previousRate ? '#10b981' : '#f59e0b';
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:${color};font-weight:700;">Commission Rate Updated</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${merchantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Your platform commission rate has been <strong style="color:${color};">${direction}</strong>.
      This change takes effect immediately for all new orders.
    </p>
    ${infoBox(color, newRate < previousRate ? '#f0fdf4' : '#fffbeb', [
      ['Previous Rate', `${previousRate}%`],
      ['New Rate', `<strong style="font-size:16px;color:${color};">${newRate}%</strong>`],
      ['Effective', 'Immediately - applies to all future orders'],
    ])}
    <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">
      If you have questions about this change, please contact your account manager or reach us at
      <a href="mailto:support@iprime.ng" style="color:#EA580C;">support@iprime.ng</a>.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `Your iPrime commission rate has been updated to ${newRate}%`,
    html,
    text: `Dear ${merchantName}, your commission rate has changed from ${previousRate}% to ${newRate}%. This takes effect immediately.`,
  });
};

// ============================================================
// Marketing-site contact form
// ============================================================

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Forward a marketing-site contact-form submission to the inbox.
 * The Reply-To is set to the submitter so support staff can hit Reply directly.
 */
const sendContactInquiryEmail = async ({ to, name, email, message, source }) => {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const safeSource = source ? escapeHtml(source) : null;

  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">New contact form message</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Someone reached out via the iPrime website contact form.</p>
    ${infoBox('#EA580C', '#fff7ed', [
      ['Name', safeName],
      ['Email', `<a href="mailto:${safeEmail}" style="color:#EA580C;">${safeEmail}</a>`],
      ...(safeSource ? [['Submitted from', safeSource]] : []),
    ])}
    <div style="background:#fafafa;border-radius:10px;padding:18px 20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <p style="margin:0;font-size:15px;color:#111827;line-height:1.6;">${safeMessage}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">Reply to this email to respond to ${safeName} directly.</p>
  `);

  return getTransporter().sendMail({
    from: `"iPrime Website" <${config.SMTP_USER}>`,
    to,
    replyTo: email,
    subject: `Website contact - ${name}`,
    html,
    text: `New contact form submission\n\nFrom: ${name} <${email}>${source ? `\nFrom page: ${source}` : ''}\n\nMessage:\n${message}\n`,
  }).then((info) => {
    logger.info('Contact inquiry forwarded', { to, from: email, messageId: info.messageId });
    return info;
  });
};

/**
 * Confirmation auto-reply to the form submitter so they know we got it.
 */
const sendContactConfirmationEmail = async ({ name, email }) => {
  const safeName = escapeHtml(name);
  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">We got your message</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${safeName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Thanks for reaching out to iPrime. A human on our team will get back to you
      within one business day at this email address.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#166534;">
        Need a faster response? You can also email us at
        <a href="mailto:hello@iprime.ng" style="color:#EA580C;">hello@iprime.ng</a>
        or message us on WhatsApp.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">- The iPrime team</p>
  `);

  return sendEmail({
    to: email,
    subject: 'We received your message - iPrime',
    html,
    text: `Hi ${name},\n\nThanks for reaching out to iPrime. A human on our team will get back to you within one business day.\n\n- The iPrime team`,
  });
};

/**
 * Internal team alert: a merchant application needs review. Fires on a brand-new
 * application and on a resubmission after rejection, so the pending queue is
 * never silent. Sent to the team inbox (CONTACT_INBOX_EMAIL), not the merchant.
 */
const sendMerchantApplicationAlertEmail = async ({ to, merchantName, contactEmail, contactPhone, isResubmission = false }) => {
  const heading = isResubmission ? 'Merchant application resubmitted' : 'New merchant application';
  const lead = isResubmission
    ? 'A previously rejected merchant has fixed their profile and resubmitted for review.'
    : 'A new merchant has registered and is waiting for approval.';

  const html = emailBase(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#EA580C;font-weight:700;">${heading}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${lead}</p>
    ${infoBox('#EA580C', '#fff7ed', [
      ['Business', escapeHtml(merchantName || '-')],
      ...(contactEmail ? [['Email', escapeHtml(contactEmail)]] : []),
      ...(contactPhone ? [['Phone', escapeHtml(contactPhone)]] : []),
      ['Status', 'Pending approval'],
    ])}
    <p style="margin:0;font-size:13px;color:#9ca3af;">Open the admin dashboard to review it under Merchants → Pending.</p>
  `);

  return sendEmail({
    to,
    subject: `${isResubmission ? 'Resubmitted' : 'New'} merchant application - ${merchantName || 'Unknown'}`,
    html,
    text: `${lead}\n\nBusiness: ${merchantName || '-'}${contactEmail ? `\nEmail: ${contactEmail}` : ''}${contactPhone ? `\nPhone: ${contactPhone}` : ''}\nStatus: Pending approval\n\nReview it in the admin dashboard under Merchants > Pending.`,
  });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendMerchantApprovedEmail,
  sendMerchantRejectedEmail,
  sendMerchantSuspendedEmail,
  sendMerchantUnsuspendedEmail,
  sendMerchantApplicationAlertEmail,
  sendWithdrawalApprovedEmail,
  sendWithdrawalRejectedEmail,
  sendCommissionChangedEmail,
  sendContactInquiryEmail,
  sendContactConfirmationEmail,
};
