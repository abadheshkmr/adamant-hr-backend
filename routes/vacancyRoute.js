import express from 'express';
import {addVacancy , listVacancy, getVacancy, updateVacancy, removeVacancy, bulkRemoveVacancy, bulkUpdateStatus} from '../controllers/vacancyController.js';
import verifyAdmin from '../middleware/verifyAdmin.js';

const vacancyRouter = express.Router();

// Add logging middleware for debugging
vacancyRouter.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Vacancy Route: ${req.method} ${req.path}`);
    next();
});

vacancyRouter.post("/add" , verifyAdmin , addVacancy)
vacancyRouter.get("/list", listVacancy); // Public endpoint (frontend needs this), admin panel can also use it
vacancyRouter.get("/get/:id", getVacancy); // Public endpoint for detailed view
vacancyRouter.put("/update", verifyAdmin, updateVacancy); // Admin only, for editing
vacancyRouter.post("/remove", verifyAdmin , removeVacancy)
vacancyRouter.post("/bulk-remove", verifyAdmin, bulkRemoveVacancy); // Admin only, bulk delete
vacancyRouter.put("/bulk-update-status", verifyAdmin, bulkUpdateStatus); // Admin only, bulk status update

export default vacancyRouter;
