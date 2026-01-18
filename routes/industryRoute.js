import express from 'express';
import { addIndustry , getIndustry , listIndustry , removeIndustry , updateIndustry} from '../controllers/industryController.js';
import multer from 'multer';

const industryRouter = express.Router();

// Image Storage Engine

const Storage = multer.diskStorage({
    destination:"uploads",
    filename:(req , file , cb)=>{
        return cb(null,`${Date.now()}${file.originalname}`)
    }
})

const upload = multer({storage:Storage})

industryRouter.post("/add" ,upload.single("image"),addIndustry)
industryRouter.get("/get/:id", getIndustry);
industryRouter.get("/list",listIndustry);
industryRouter.post("/remove", upload.none("image") , removeIndustry);
industryRouter.put("/update", upload.single("image") , updateIndustry);

export default industryRouter;