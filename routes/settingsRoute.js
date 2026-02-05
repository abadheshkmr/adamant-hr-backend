import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { requireAdminRole } from '../middleware/verifyAdmin.js';

const settingsRouter = express.Router();

settingsRouter.get('/', getSettings);
settingsRouter.patch('/', requireAdminRole(['superadmin', 'admin']), updateSettings);

export default settingsRouter;
