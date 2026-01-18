import express from 'express';
import {addVacancy , listVacancy , removeVacancy} from '../controllers/vacancyController.js';
import verifyAdmin from '../middleware/verifyAdmin.js';

const vacancyRouter = express.Router();

vacancyRouter.post("/add" , verifyAdmin , addVacancy)
vacancyRouter.get("/list", listVacancy);
vacancyRouter.post("/remove", verifyAdmin , removeVacancy);

export default vacancyRouter;
