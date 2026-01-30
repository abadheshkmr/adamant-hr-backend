import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';

// In-memory store: email (lowercase) -> { code, expiresAt }
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getTransporter() {
  const nodemailer = await import('nodemailer');
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@localhost';
  if (!host || !user || !pass) return null;
  return nodemailer.default.createTransport({
    host,
    port: Number(port),
    secure: String(port) === '465',
    auth: { user, pass },
  });
}

export async function sendEmailOtp(req, res) {
  try {
    const { email } = req.body || {};
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    const transporter = await getTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        message: 'Email (SMTP) is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env',
      });
    }

    const code = generateOtp();
    otpStore.set(normalized, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from: from || 'Career Portal <noreply@localhost>',
      to: normalized,
      subject: 'Your sign-in code',
      text: `Your one-time sign-in code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your one-time sign-in code is: <strong>${code}</strong></p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    });

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('[sendEmailOtp]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to send OTP' });
  }
}

export async function verifyEmailOtp(req, res) {
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
    }

    const { email, code } = req.body || {};
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }
    const enteredCode = (code || '').trim();
    if (!enteredCode || enteredCode.length !== 6) {
      return res.status(400).json({ success: false, message: 'Valid 6-digit code is required' });
    }

    const stored = otpStore.get(normalized);
    if (!stored) {
      return res.status(400).json({ success: false, message: 'No OTP found for this email. Request a new code.' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normalized);
      return res.status(400).json({ success: false, message: 'Code expired. Request a new code.' });
    }
    if (stored.code !== enteredCode) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    otpStore.delete(normalized);

    const admin = getFirebaseAdmin();
    let user;
    try {
      user = await admin.auth().getUserByEmail(normalized);
    } catch {
      user = await admin.auth().createUser({
        email: normalized,
        emailVerified: false,
      });
    }

    const customToken = await admin.auth().createCustomToken(user.uid);
    return res.json({ success: true, data: { token: customToken } });
  } catch (err) {
    console.error('[verifyEmailOtp]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: err?.message || 'Verification failed' });
  }
}
