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

const ALLOWED_ADMIN_ROLES = ['hr', 'admin', 'superadmin'];

/** Returns true if uid belongs to an internal admin user (allowed domain + role). Used to validate recruiterUid on jobs. */
export async function isInternalUser(uid) {
  if (!uid || typeof uid !== 'string') return false;
  try {
    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) return false;
    const allowedDomains = parseListEnv('INTERNAL_EMAIL_DOMAINS');
    if (allowedDomains.length === 0) return false;
    const admin = getFirebaseAdmin();
    const user = await admin.auth().getUser(uid);
    const domain = emailDomain(user.email);
    if (!domain || !allowedDomains.includes(domain)) return false;
    const role = user.customClaims?.role || (parseListEnv('INTERNAL_SUPERADMINS').includes((user.email || '').toLowerCase()) ? 'superadmin' : null);
    return !!role && ALLOWED_ADMIN_ROLES.includes(role);
  } catch {
    return false;
  }
}

/** Returns list of internal users (allowed domain + has role). Used by listInternalUsers and by recruiter dropdown. */
export async function getInternalUsersList() {
  const init = initFirebaseAdmin();
  if (!init.firebaseInitialized) return [];
  const allowedDomains = parseListEnv('INTERNAL_EMAIL_DOMAINS');
  if (allowedDomains.length === 0) return [];
  const admin = getFirebaseAdmin();
  const users = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(500, pageToken);
    for (const u of result.users) {
      const domain = emailDomain(u.email);
      if (domain && allowedDomains.includes(domain)) {
        const role = u.customClaims?.role || (parseListEnv('INTERNAL_SUPERADMINS').includes((u.email || '').toLowerCase()) ? 'superadmin' : null);
        if (role && ALLOWED_ADMIN_ROLES.includes(role)) {
          users.push({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || null,
            photoURL: u.photoURL || null,
            role,
            disabled: u.disabled || false,
          });
        }
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);
  users.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  return users;
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
    const users = await getInternalUsersList();
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('[listInternalUsers]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/** GET /api/admin/internal-users - list internal users for vacancy dropdown (assignable as recruiter). Callable by superadmin/admin/hr. */
export async function listInternalUsersForAssignment(req, res) {
  try {
    const users = await getInternalUsersList();
    const data = users
      .filter((u) => !u.disabled)
      .map(({ uid, email, displayName, photoURL }) => ({
        uid,
        email: email || null,
        displayName: displayName || null,
        photoURL: photoURL || null,
      }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[listInternalUsersForAssignment]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

