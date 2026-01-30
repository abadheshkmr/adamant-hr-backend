/**
 * One-time seed: set Firebase custom claim role = 'superadmin' for a user.
 * Run after creating the user in Firebase Console (Authentication → Add user).
 *
 * Usage (from hr-backend root):
 *   node scripts/seedSuperadmin.js <email>
 *   node scripts/seedSuperadmin.js admin@adamant-hr.com
 *
 * Requires: .env with FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_PATH (or client email + private key).
 */

import 'dotenv/config';
import { initFirebaseAdmin, getFirebaseAdmin } from '../utils/firebaseAdmin.js';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Usage: node scripts/seedSuperadmin.js <email>');
  console.error('Example: node scripts/seedSuperadmin.js admin@adamant-hr.com');
  process.exit(1);
}

const { firebaseInitialized, reason } = initFirebaseAdmin();
if (!firebaseInitialized) {
  console.error('Firebase Admin not initialized:', reason || 'unknown');
  process.exit(1);
}

const admin = getFirebaseAdmin();

try {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role: 'superadmin' });
  console.log('OK: Set role=superadmin for', email, '(uid:', user.uid + ')');
} catch (err) {
  if (err.code === 'auth/user-not-found') {
    console.error('User not found for email:', email);
    console.error('Create the user in Firebase Console (Authentication → Add user) first, then run this script again.');
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
}

process.exit(0);
