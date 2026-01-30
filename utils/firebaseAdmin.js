import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let firebaseInitialized = false;

export function initFirebaseAdmin() {
  if (firebaseInitialized) return { firebaseInitialized: true };

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!projectId) {
    return { firebaseInitialized: false, reason: 'FIREBASE_PROJECT_ID not set' };
  }

  try {
    if (serviceAccountPath) {
      const path = resolve(process.cwd(), serviceAccountPath);
      const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      firebaseInitialized = true;
      return { firebaseInitialized: true };
    }

    if (clientEmail && privateKey) {
      const key = privateKey.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: key,
        }),
      });
      firebaseInitialized = true;
      return { firebaseInitialized: true };
    }

    return { firebaseInitialized: false, reason: 'Firebase credentials not configured' };
  } catch (err) {
    return { firebaseInitialized: false, reason: err?.message || 'Firebase init error' };
  }
}

export function getFirebaseAdmin() {
  return admin;
}

