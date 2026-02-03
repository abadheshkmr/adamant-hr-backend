import { verifyFirebaseToken } from './verifyFirebaseUser.js';

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

export function requireAdminRole(allowedRoles = ['hr', 'admin', 'superadmin']) {
  return async (req, res, next) => {
    try {
      await verifyFirebaseToken(req, res, async () => {
        const email = req.firebaseUser?.email;
        const role = req.firebaseUser?.role || null;
        const token = req.firebaseToken || {};

        if (!email) {
          return res.status(401).json({ success: false, message: 'Access denied. Email not present on token.' });
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
        const effectiveRole = role || (superAdmins.includes(email.toLowerCase()) ? 'superadmin' : null);

        if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
          return res.status(403).json({ success: false, message: 'Forbidden. Insufficient role.' });
        }

        req.admin = {
          uid: token.uid || req.firebaseUser?.uid,
          email,
          role: effectiveRole,
        };
        return next();
      });
    } catch (err) {
      console.error('[verifyAdmin] Error:', err?.message, err?.stack);
      return res.status(401).json({ success: false, message: 'Access denied. Authentication failed.' });
    }
  };
}

// Default: any internal admin role can access admin-protected routes
export default requireAdminRole(['hr', 'admin', 'superadmin']);