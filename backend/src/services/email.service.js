/**
 * Email service — sends transactional emails via Gmail SMTP.
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
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">VTU Logistics</h1>
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
                    &copy; ${new Date().getFullYear()} VTU Logistics Platform. All rights reserved.
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
    subject: `${otp} — Your VTU Logistics verification code`,
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
                  <h1 style="margin:0;font-size:24px;color:#1a1a2e;font-weight:700;">Welcome to VTU Logistics!</h1>
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
                    &copy; ${new Date().getFullYear()} VTU Logistics Platform
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
    subject: `Welcome to VTU Logistics, ${firstName}!`,
    html,
    text: `Hi ${firstName}, welcome to VTU Logistics! Your account is ready.`,
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
                    &copy; ${new Date().getFullYear()} VTU Logistics Platform
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
    subject: `${otp} — Password reset code`,
    html,
    text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
  });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
