import { fileURLToPath } from 'url';
import { dirname } from 'path';
import CandidateModel from '../models/candidateModel.js';
import ClientModel from '../models/clientModel.js';
import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Verifies Firebase ID token and attaches decoded user to req.firebaseUser.
 * Use for routes that need any authenticated Firebase user.
 */
export const verifyFirebaseToken = async (req, res, next) => {
  const init = initFirebaseAdmin();
  if (!init.firebaseInitialized) {
    console.warn('[verifyFirebaseUser] 503 Firebase auth not configured - request rejected');
    return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
  }

  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[verifyFirebaseUser] 401 No Bearer token in Authorization header');
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    console.warn('[verifyFirebaseUser] 401 Empty token after Bearer prefix');
    return res.status(401).json({ success: false, message: 'Access denied. Invalid token.' });
  }

  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseToken = decoded;
    req.firebaseUser = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      picture: decoded.picture || null,
      role: decoded.role || null,
      phone_number: decoded.phone_number || decoded.firebase?.sign_in_attributes?.phone_number || null,
    };
    next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      console.warn('[verifyFirebaseUser] 401 Token expired');
      return res.status(401).json({ success: false, message: 'Token expired. Please sign in again.' });
    }
    if (err.code === 'auth/id-token-revoked' || err.code === 'auth/invalid-id-token') {
      console.warn('[verifyFirebaseUser] 401 Token revoked or invalid:', err.code);
      return res.status(401).json({ success: false, message: 'Invalid token. Please sign in again.' });
    }
    console.error('[verifyFirebaseUser] Token verification error:', { code: err.code, message: err.message });
    return res.status(401).json({ success: false, message: 'Access denied. Authentication failed.' });
  }
};

/**
 * Verifies Firebase token and ensures user is a linked candidate.
 * Attaches req.candidate.
 */
export const verifyFirebaseCandidate = async (req, res, next) => {
  await verifyFirebaseToken(req, res, async () => {
    const uid = req.firebaseUser?.uid;
    if (!uid) return next();

    try {
      const candidate = await CandidateModel.findOne({ firebaseUid: uid }).lean();
      if (!candidate) {
        console.warn('[verifyFirebaseCandidate] 403 No candidate linked for this Firebase UID:', { uid });
        return res.status(403).json({
          success: false,
          message: 'Complete your profile first. Go to the registration page and enter your name, email, and phone.',
        });
      }
      req.candidate = candidate;
      next();
    } catch (err) {
      console.error('[verifyFirebaseCandidate] Lookup error:', err.message, err.stack);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  });
};

/**
 * Verifies Firebase token and ensures user is a linked client.
 * Attaches req.client.
 */
export const verifyFirebaseClient = async (req, res, next) => {
  await verifyFirebaseToken(req, res, async () => {
    const uid = req.firebaseUser?.uid;
    if (!uid) return next();

    try {
      const client = await ClientModel.findOne({ firebaseUid: uid }).lean();
      if (!client) {
        console.warn('[verifyFirebaseClient] 403 No client linked for this Firebase UID:', { uid });
        return res.status(403).json({
          success: false,
          message: 'No client account linked to this login.',
        });
      }
      req.client = client;
      next();
    } catch (err) {
      console.error('[verifyFirebaseClient] Lookup error:', err.message, err.stack);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  });
};
