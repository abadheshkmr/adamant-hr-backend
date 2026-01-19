import express from "express";
import { addCV, getCV, listCVs, removeCV } from "../controllers/cvController.js";
import multer from "multer";
import CVModel from "../models/cvModel.js";
import { uploadLimiter } from "../middleware/ddosProtection.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const cvRouter = express.Router();

// Resume Storage Engine
const resumeStorage = multer.diskStorage({
  destination: "uploads/resumes", // different folder for resumes
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: async (req, file, cb) => {
    try {
      const exist = await CVModel.findOne({ email: req.body.email });
      if (exist) {
        // Reject the file if CV already exists
        return cb(new Error("already applied"), false);
      }
      cb(null, true); // accept file
    } catch (err) {
      cb(err);
    }
  },
});

// Routes
// Apply upload rate limiting to file upload endpoints
cvRouter.post("/add", uploadLimiter, uploadResume.single("resume"), addCV); // Public endpoint for job applications
cvRouter.get("/get/:id", verifyAdmin, getCV); // Admin only
cvRouter.get("/list", verifyAdmin, listCVs); // Admin only
cvRouter.post("/remove", verifyAdmin, uploadResume.none(), removeCV); // Admin only

export default cvRouter;
