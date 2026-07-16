import nodemailer from 'nodemailer';

/**
 * Thin wrapper around an SMTP transport, configured entirely from env vars so
 * the app can point at an intranet mail server (or M365/Exchange) without code
 * changes:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false"),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If SMTP_HOST is not set, isMailerConfigured() returns false and callers
 * should surface a clear "email not configured" message rather than failing.
 */

let transporter: nodemailer.Transporter | null = null;

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransport(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) throw new Error('SMTP is not configured (SMTP_HOST missing)');

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  transporter = nodemailer.createTransport({
    host,
    port,
    // secure=true for port 465; STARTTLS (false) for 587/25.
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vegam.local';
  await getTransport().sendMail({ from, to, subject, html });
}

export async function sendOtpEmail(to: string, otp: string, userName: string): Promise<void> {
  const subject = 'Your Vegam Revenue verification code';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1a56db;">Verify your email</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Use this one-time code to confirm your new email address on Vegam Revenue Management:</p>
      <p style="font-size:28px; font-weight:700; letter-spacing:4px; color:#001529;">${otp}</p>
      <p style="color:#888;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>`;
  await sendMail(to, subject, html);
}
