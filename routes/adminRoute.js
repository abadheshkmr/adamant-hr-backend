import express from 'express';
import { loginAdmin } from '../controllers/adminController.js';
import { authLimiter } from '../middleware/ddosProtection.js';
import { verifyFirebaseToken } from '../middleware/verifyFirebaseUser.js';
import verifyAdmin, { requireAdminRole } from '../middleware/verifyAdmin.js';
import { inviteUser, listInternalUsers, setUserDisabled, setUserRole, verifyAdminAuth } from '../controllers/adminUsersController.js';

const adminRouter = express.Router();

// Apply strict rate limiting to admin login
adminRouter.post('/login', authLimiter, loginAdmin);

// New admin auth verification (Firebase token + internal domain + role)
adminRouter.post('/auth/verify', verifyFirebaseToken, verifyAdminAuth);

// User management (superadmin only)
adminRouter.get('/users', requireAdminRole(['superadmin']),    );
adminRouter.post('/users/invite', requireAdminRole(['superadmin']), inviteUser);
adminRouter.post('/users/set-role', requireAdminRole(['superadmin']), setUserRole);
adminRouter.post('/users/set-disabled', requireAdminRole(['superadmin']), setUserDisabled);

export default adminRouter;
