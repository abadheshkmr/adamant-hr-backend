import express from 'express';
import { loginAdmin } from '../controllers/adminController.js';
import { authLimiter } from '../middleware/ddosProtection.js';

const adminRouter = express.Router();

// Apply strict rate limiting to admin login
adminRouter.post('/login', authLimiter, loginAdmin);

export default adminRouter;
