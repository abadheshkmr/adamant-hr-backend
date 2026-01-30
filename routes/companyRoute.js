import express from 'express';
import { addCompany, getCompany, listCompanies, updateCompany, removeCompany } from '../controllers/companyController.js';
import verifyAdmin from '../middleware/verifyAdmin.js';

const companyRouter = express.Router();

companyRouter.post('/add', verifyAdmin, addCompany);
companyRouter.get('/get/:id', verifyAdmin, getCompany);
companyRouter.get('/list', verifyAdmin, listCompanies);
companyRouter.put('/update/:id', verifyAdmin, updateCompany);
companyRouter.post('/remove', verifyAdmin, removeCompany);

export default companyRouter;
