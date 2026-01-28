import express from "express";
import { addCV, getCV, listCVs, listCandidates, getCandidate, updateApplicationStatus, removeCV, getApplicationCount, getApplicationCountsBatch } from "../controllers/cvController.js";
import multer from "multer";
import ApplicationModel from "../models/applicationModel.js";
import CandidateModel from "../models/candidateModel.js";
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
      // Check for duplicates: same candidate + jobId combination
      // This allows same person to apply to different jobs, but prevents duplicate applications to same job
      if (req.body.email && req.body.jobId) {
        const normalizedEmail = req.body.email.toLowerCase().trim();
        const normalizedJobId = req.body.jobId.toString().trim();
        
        // Find candidate by email
        const candidate = await CandidateModel.findOne({ email: normalizedEmail });
        
        if (candidate) {
          // Check if application already exists
          const exist = await ApplicationModel.findOne({
            candidateId: candidate._id,
            jobId: normalizedJobId
          });
          
          if (exist) {
            // Reject the file if this person has already applied to this specific job
            return cb(new Error("already applied"), false);
          }
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
// Public endpoint for application count
cvRouter.get("/count/:jobId", getApplicationCount); // Get application count for a job (public)
cvRouter.post("/counts/batch", getApplicationCountsBatch); // Get application counts for multiple jobs (public)

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

// Application routes (admin only)
cvRouter.get("/get/:id", verifyAdmin, getCV); // Get single application
cvRouter.get("/list", verifyAdmin, listCVs); // List all applications (can filter by jobId or candidateId)
cvRouter.post("/update-status", verifyAdmin, updateApplicationStatus); // Update application status
cvRouter.post("/remove", verifyAdmin, uploadResume.none(), removeCV); // Delete application

// Candidate routes (admin only) - NEW for normalized structure
cvRouter.get("/candidates", verifyAdmin, listCandidates); // List all unique candidates
cvRouter.get("/candidate/:id", verifyAdmin, getCandidate); // Get candidate with all their applications

export default cvRouter;
