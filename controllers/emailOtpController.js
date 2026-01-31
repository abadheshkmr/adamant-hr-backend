import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';

// In-memory store: email (lowercase) -> { code, expiresAt }
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/** For merge flow: verify email OTP and consume it. Returns { valid, message }. */
export function verifyAndConsumeEmailOtp(email, code) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
    return { valid: false, message: 'Valid email is required' };
  }
  const enteredCode = (code || '').trim();
  if (!enteredCode || enteredCode.length !== 6) {
    return { valid: false, message: 'Valid 6-digit code is required' };
  }
  const stored = otpStore.get(normalized);
  if (!stored) {
    return { valid: false, message: 'No OTP found for this email. Request a new code.' };
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalized);
    return { valid: false, message: 'Code expired. Request a new code.' };
  }
  if (stored.code !== enteredCode) {
    return { valid: false, message: 'Invalid code' };
  }
  otpStore.delete(normalized);
  return { valid: true };
}

// Phone OTP for merge flow (keyed by digits). SMS sending requires Twilio/etc.
const phoneOtpStore = new Map();

export function verifyAndConsumePhoneOtp(phoneDigits, code) {
  const digits = (phoneDigits || '').replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return { valid: false, message: 'Valid phone number is required' };
  }
  const enteredCode = (code || '').trim();
  if (!enteredCode || enteredCode.length !== 6) {
    return { valid: false, message: 'Valid 6-digit code is required' };
  }
  const stored = phoneOtpStore.get(digits);
  if (!stored) {
    return { valid: false, message: 'No OTP found for this phone. Request a new code.' };
  }
  if (Date.now() > stored.expiresAt) {
    phoneOtpStore.delete(digits);
    return { valid: false, message: 'Code expired. Request a new code.' };
  }
  if (stored.code !== enteredCode) {
    return { valid: false, message: 'Invalid code' };
  }
  phoneOtpStore.delete(digits);
  return { valid: true };
}

/** Format digits to E.164 for Twilio (e.g. +14692685229 or +919876543210). */
function toE164(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d || d.length < 10) return null;
  const region = (process.env.PHONE_REGION || 'US').toUpperCase();
  if (d.length === 10 && region === 'US') return `+1${d}`;
  if (d.length === 10 && region === 'IN') return `+91${d}`;
  return `+${d}`;
}

/** Send OTP to phone for merge. Returns 501 if SMS not configured (Twilio). */
export async function sendMergePhoneOtp(req, res) {
  try {
    const { phone } = req.body || {};
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const smsConfigured = Boolean(accountSid && authToken && fromNumber);
    if (!smsConfigured) {
      return res.status(501).json({
        success: false,
        message: 'SMS is not configured. Sign in with that phone number from the login page instead, or use a different number.',
      });
    }
    const code = generateOtp();
    phoneOtpStore.set(digits, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });

    const toE164Number = toE164(digits);
    if (!toE164Number) {
      return res.status(400).json({ success: false, message: 'Invalid phone number for this region' });
    }
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      to: toE164Number,
      from: fromNumber,
      body: `Your verification code is: ${code}. It expires in 10 minutes.`,
    });

    return res.json({ success: true, message: 'OTP sent to your phone' });
  } catch (err) {
    console.error('[sendMergePhoneOtp]', err?.message);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to send OTP' });
  }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isSendGridConfigured() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_MAIL_FROM;
  return Boolean(apiKey && from);
}

export async function sendEmailOtp(req, res) {
  try {
    const { email } = req.body || {};
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    if (!isSendGridConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email (SendGrid) is not configured. Set SENDGRID_API_KEY and SENDGRID_MAIL_FROM in .env',
      });
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const code = generateOtp();
    otpStore.set(normalized, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });

    const from = process.env.SENDGRID_MAIL_FROM;
    const msg = {
      to: normalized,
      from,
      subject: 'Your sign-in code',
      text: `Your one-time sign-in code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your one-time sign-in code is: <strong>${code}</strong></p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    };

    await sgMail.send(msg);

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('[sendEmailOtp]', err?.message, err?.response?.body);
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
