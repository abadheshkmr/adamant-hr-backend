import express from 'express';
import { loginAdmin } from '../controllers/adminController.js';
import { authLimiter } from '../middleware/ddosProtection.js';
import { verifyFirebaseToken } from '../middleware/verifyFirebaseUser.js';
import verifyAdmin, { requireAdminRole } from '../middleware/verifyAdmin.js';
import { inviteUser, listInternalUsers, listInternalUsersForAssignment, setUserDisabled, setUserRole, verifyAdminAuth } from '../controllers/adminUsersController.js';

const adminRouter = express.Router();

// Apply strict rate limiting to admin login
adminRouter.post('/login', authLimiter, loginAdmin);

// New admin auth verification (Firebase token + internal domain + role)
adminRouter.post('/auth/verify', verifyFirebaseToken, verifyAdminAuth);

// User management (superadmin only)
adminRouter.get('/users', requireAdminRole(['superadmin']), listInternalUsers);
adminRouter.post('/users/invite', requireAdminRole(['superadmin']), inviteUser);
adminRouter.post('/users/set-role', requireAdminRole(['superadmin']), setUserRole);
adminRouter.post('/users/set-disabled', requireAdminRole(['superadmin']), setUserDisabled);

// Internal users for vacancy assignment (who can be assigned as recruiter on a job)
adminRouter.get('/internal-users', requireAdminRole(['superadmin', 'admin', 'hr']), listInternalUsersForAssignment);

export default adminRouter;
