import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';

function parseListEnv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function emailDomain(email) {
  const at = (email || '').lastIndexOf('@');
  if (at === -1) return '';
  return email.slice(at + 1).toLowerCase();
}

export async function verifyAdminAuth(req, res) {
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
    }

    const decoded = req.firebaseToken;
    const email = decoded?.email || null;
    const uid = decoded?.uid || null;

    if (!email || !uid) {
      return res.status(401).json({ success: false, message: 'Access denied. Invalid token.' });
    }

    const allowedDomains = parseListEnv('INTERNAL_EMAIL_DOMAINS');
    if (allowedDomains.length === 0) {
      return res.status(503).json({ success: false, message: 'Admin domain allowlist not configured' });
    }

    const domain = emailDomain(email);
    if (!allowedDomains.includes(domain)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Email domain not allowed.' });
    }

    const superAdmins = parseListEnv('INTERNAL_SUPERADMINS');
    const role = decoded.role || (superAdmins.includes(email.toLowerCase()) ? 'superadmin' : null);

    if (!role) {
      return res.status(403).json({ success: false, message: 'No admin role assigned. Contact superadmin.' });
    }

    return res.json({ success: true, data: { uid, email, role } });
  } catch (err) {
    console.error('[verifyAdminAuth]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function inviteUser(req, res) {
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const allowedDomains = parseListEnv('INTERNAL_EMAIL_DOMAINS');
    const domain = emailDomain(email);
    if (!allowedDomains.includes(domain)) {
      return res.status(400).json({ success: false, message: 'Email domain not allowed' });
    }

    const admin = getFirebaseAdmin();
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      return res.json({ success: true, message: 'User already exists', data: { uid: user.uid, email: user.email } });
    } catch {
      // continue to create
    }

    user = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
    });

    return res.json({ success: true, message: 'User created', data: { uid: user.uid, email: user.email } });
  } catch (err) {
    console.error('[inviteUser]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function setUserRole(req, res) {
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
    }

    const { uid, email, role } = req.body || {};
    const allowedRoles = ['hr', 'admin', 'superadmin'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `role must be one of: ${allowedRoles.join(', ')}` });
    }

    const admin = getFirebaseAdmin();
    let targetUid = uid;
    if (!targetUid && email) {
      const user = await admin.auth().getUserByEmail(email);
      targetUid = user.uid;
    }
    if (!targetUid) {
      return res.status(400).json({ success: false, message: 'uid or email is required' });
    }

    await admin.auth().setCustomUserClaims(targetUid, { role });
    return res.json({ success: true, message: 'Role updated', data: { uid: targetUid, role } });
  } catch (err) {
    console.error('[setUserRole]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function setUserDisabled(req, res) {
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
    }

    const { uid, disabled } = req.body || {};
    if (!uid || typeof disabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'uid and disabled(boolean) are required' });
    }

    const admin = getFirebaseAdmin();
    const user = await admin.auth().updateUser(uid, { disabled });
    return res.json({ success: true, message: disabled ? 'User disabled' : 'User enabled', data: { uid: user.uid, disabled: user.disabled } });
  } catch (err) {
    console.error('[setUserDisabled]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function listInternalUsers(req, res) {
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Firebase auth not configured' });
    }

    const allowedDomains = parseListEnv('INTERNAL_EMAIL_DOMAINS');
    if (allowedDomains.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const admin = getFirebaseAdmin();
    const users = [];
    let pageToken;
    do {
      const result = await admin.auth().listUsers(500, pageToken);
      for (const u of result.users) {
        const domain = emailDomain(u.email);
        if (domain && allowedDomains.includes(domain)) {
          users.push({
            uid: u.uid,
            email: u.email,
            role: u.customClaims?.role || null,
            disabled: u.disabled || false,
          });
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    users.sort((a, b) => (a.email || '').localeCompare(b.email || ''));

    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('[listInternalUsers]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

