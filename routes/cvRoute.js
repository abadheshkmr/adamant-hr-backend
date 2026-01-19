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
      // Check for duplicates: same email + jobId combination
      // This allows same person to apply to different jobs, but prevents duplicate applications to same job
      if (req.body.email && req.body.jobId) {
        const exist = await CVModel.findOne({ 
          email: req.body.email.toLowerCase().trim(),
          jobId: req.body.jobId.toString().trim()
        });
        if (exist) {
          // Reject the file if this person has already applied to this specific job
          return cb(new Error("already applied"), false);
        }
      }
      cb(null, true); // accept file
    } catch (err) {
      cb(err);
    }
  },
});

// Error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error(`[${new Date().toISOString()}] Multer Error:`, err);
    
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    
    // Handle custom errors from fileFilter (like "already applied")
    if (err.message === "already applied") {
      return res.status(400).json({ 
        success: false, 
        message: "You have already applied to this job position. Please check your email or contact support if you believe this is an error." 
      });
    }
    
    return res.status(400).json({ success: false, message: err.message || "File upload error" });
  }
  next();
};

// Routes
// Apply upload rate limiting to file upload endpoints
// Note: Error handler must come after multer middleware
cvRouter.post("/add", uploadLimiter, (req, res, next) => {
  uploadResume.single("resume")(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, addCV); // Public endpoint for job applications
cvRouter.get("/get/:id", verifyAdmin, getCV); // Admin only
cvRouter.get("/list", verifyAdmin, listCVs); // Admin only
cvRouter.post("/remove", verifyAdmin, uploadResume.none(), removeCV); // Admin only

export default cvRouter;
