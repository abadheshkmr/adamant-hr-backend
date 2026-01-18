import express from 'express';
import {addService , getService , listService , removeService , updateService} from '../controllers/serviceController.js';
import multer from 'multer';

const serviceRouter = express.Router();

// Image Storage Engine

const Storage = multer.diskStorage({
    destination:"uploads",
    filename:(req , file , cb)=>{
        return cb(null,`${Date.now()}${file.originalname}`)
    }
})

const upload = multer({storage:Storage})

serviceRouter.post("/add" ,upload.single("image"),addService)
serviceRouter.get("/get/:id", getService);
serviceRouter.get("/list",listService);
serviceRouter.post("/remove", upload.none() , removeService);
serviceRouter.put("/update", upload.single("image") , updateService);

export default serviceRouter;