import express from 'express';
import { loginAdmin } from '../controllers/adminController.js';
import { authLimiter } from '../middleware/ddosProtection.js';
import { verifyFirebaseToken } from '../middleware/verifyFirebaseUser.js';
import { requireAdminRole } from '../middleware/verifyAdmin.js';
import { inviteUser, listInternalUsers, listInternalUsersForAssignment, setUserDisabled, setUserRole, verifyAdminAuth } from '../controllers/adminUsersController.js';
import { getPendingCount, listPending, getDocumentDownloadUrl, setVerification } from '../controllers/adminDocumentController.js';

const adminRouter = express.Router();

// Admin login is via Firebase only; this endpoint returns a helpful message
adminRouter.post('/login', authLimiter, loginAdmin);

// Admin auth verification: Firebase token + internal domain + role
adminRouter.post('/auth/verify', verifyFirebaseToken, verifyAdminAuth);

// User management (superadmin only)
adminRouter.get('/users', requireAdminRole(['superadmin']), listInternalUsers);
adminRouter.post('/users/invite', requireAdminRole(['superadmin']), inviteUser);
adminRouter.post('/users/set-role', requireAdminRole(['superadmin']), setUserRole);
adminRouter.post('/users/set-disabled', requireAdminRole(['superadmin']), setUserDisabled);

// Internal users for vacancy assignment (who can be assigned as recruiter on a job)
adminRouter.get('/internal-users', requireAdminRole(['superadmin', 'admin', 'hr']), listInternalUsersForAssignment);

// Document verification (manual KYC)
adminRouter.get('/documents/pending-count', requireAdminRole(['superadmin', 'admin', 'hr']), getPendingCount);
adminRouter.get('/documents/pending', requireAdminRole(['superadmin', 'admin', 'hr']), listPending);
adminRouter.get('/candidates/:candidateId/documents/:documentId/download-url', requireAdminRole(['superadmin', 'admin', 'hr']), getDocumentDownloadUrl);
adminRouter.patch('/candidates/:candidateId/documents/:documentId/verification', requireAdminRole(['superadmin', 'admin', 'hr']), setVerification);

export default adminRouter;
