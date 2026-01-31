import express from "express";
import fs from "fs";
import { addCV, getCV, listCVs, listCandidates, getCandidate, updateApplicationStatus, removeCV } from "../controllers/cvController.js";
import multer from "multer";
import ApplicationModel from "../models/applicationModel.js";
import CandidateModel from "../models/candidateModel.js";
import { uploadLimiter } from "../middleware/ddosProtection.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const cvRouter = express.Router();

// Resume + Cover Letter storage (different folders by field name)
const applicationFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'coverLetter' ? 'uploads/coverLetters' : 'uploads/resumes';
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) { /* ignore */ }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const uploadResume = multer({
  storage: applicationFileStorage,
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
// Apply upload rate limiting to file upload endpoints
// Note: Error handler must come after multer middleware (resume required, coverLetter optional)
cvRouter.post("/add", uploadLimiter, (req, res, next) => {
  uploadResume.fields([{ name: 'resume', maxCount: 1 }, { name: 'coverLetter', maxCount: 1 }])(req, res, (err) => {
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
