import express from 'express';
import { submitContactForm, submitEmployerForm } from '../controllers/contactController.js';
import { contactLimiter } from '../middleware/ddosProtection.js';

const contactRouter = express.Router();

contactRouter.post('/', contactLimiter, submitContactForm);
contactRouter.post('/employer', contactLimiter, submitEmployerForm);

export default contactRouter;
