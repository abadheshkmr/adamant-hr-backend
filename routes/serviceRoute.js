import express from 'express';
import {addService , getService , listService , removeService , updateService} from '../controllers/serviceController.js';
import multer from 'multer';
import verifyAdmin from '../middleware/verifyAdmin.js';

const serviceRouter = express.Router();

// Image Storage Engine

const Storage = multer.diskStorage({
    destination:"uploads",
    filename:(req , file , cb)=>{
        return cb(null,`${Date.now()}${file.originalname}`)
    }
})

const upload = multer({storage:Storage})

serviceRouter.post("/add" , verifyAdmin, upload.single("image"), addService)
serviceRouter.get("/get/:id", getService); // Public endpoint
serviceRouter.get("/list", listService); // Public endpoint
serviceRouter.post("/remove", verifyAdmin, upload.none() , removeService);
serviceRouter.put("/update", verifyAdmin, upload.single("image") , updateService);

export default serviceRouter;