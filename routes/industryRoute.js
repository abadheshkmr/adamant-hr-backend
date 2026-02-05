import express from 'express';
import { addIndustry, getIndustry, listIndustry, removeIndustry, updateIndustry, bulkIndustries } from '../controllers/industryController.js';
import multer from 'multer';
import verifyAdmin from '../middleware/verifyAdmin.js';

const industryRouter = express.Router();

// Image Storage Engine

const Storage = multer.diskStorage({
    destination:"uploads",
    filename:(req , file , cb)=>{
        return cb(null,`${Date.now()}${file.originalname}`)
    }
})

const upload = multer({storage:Storage})

industryRouter.post("/add", verifyAdmin, upload.single("image"), addIndustry);
industryRouter.post("/bulk", verifyAdmin, bulkIndustries);
industryRouter.get("/get/:id", getIndustry); // Public endpoint
industryRouter.get("/list", listIndustry); // Public endpoint
industryRouter.post("/remove", verifyAdmin, upload.none("image") , removeIndustry);
industryRouter.put("/update", verifyAdmin, upload.single("image") , updateIndustry);

export default industryRouter;