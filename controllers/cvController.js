import CVModel from "../models/cvModel.js";
import fs from "fs";

// add CV

const addCV = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.email || !req.body.jobId) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and Job ID are required" 
      });
    }

    let resume_filename = req.file ? `${req.file.filename}` : null;

    // Normalize email and jobId
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const normalizedJobId = req.body.jobId.toString().trim();

    // Check for duplicate: same email + jobId combination
    // This allows same person to apply to different jobs, but prevents duplicate applications to same job
    const exist = await CVModel.findOne({
      email: normalizedEmail,
      jobId: normalizedJobId
    });
    
    if (exist) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already applied to this job position. Please check your email or contact support if you believe this is an error." 
      });
    }

    const cv = new CVModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: normalizedEmail,
      address: req.body.address,
      mobileNo: req.body.mobileNo,
      jobId: normalizedJobId,
      city: req.body.city,
      state: req.body.state,
      tenthPercentage: req.body.tenthPercentage ? parseFloat(req.body.tenthPercentage) : undefined,
      twelfthPercentage: req.body.twelfthPercentage ? parseFloat(req.body.twelfthPercentage) : undefined,
      degree: req.body.degree,
      degreeCgpa: req.body.degreeCgpa ? parseFloat(req.body.degreeCgpa) : undefined,
      resume: { url: resume_filename ? `uploads/resumes/${resume_filename}` : null },
    });

    await cv.save();
    res.status(200).json({ success: true, message: "Application submitted successfully" });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Add CV Error:`, error);
    console.error('Error stack:', error.stack);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      // Check if it's the old email index error
      if (error.keyPattern && error.keyPattern.email === 1 && !error.keyPattern.jobId) {
        console.error('⚠️  Old unique index on email detected. Please run migration script: node scripts/migrateCVIndex.js');
        return res.status(500).json({ 
          success: false, 
          message: "Database configuration error. Please contact support. Error: Old index structure detected." 
        });
      }
      
      // It's the compound index error (email + jobId) - user already applied
      return res.status(400).json({ 
        success: false, 
        message: "You have already applied to this job position. Please check your email or contact support if you believe this is an error." 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${errors}` 
      });
    }
    
    // Generic server error
    res.status(500).json({ 
      success: false, 
      message: "Error submitting application. Please try again later." 
    });
  }
};

// get CV by id
const getCV = async (req, res) => {
  try {
    const cv = await CVModel.findById(req.params.id);
    res.json(cv ? { success: true, data: cv } : { success: false, message: "CV not found" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// list all CVs
const listCVs = async (req, res) => {
  try {
    
    const { jobId } = req.query;
    const filter = jobId ? { jobId } : {};
    const cvs = await CVModel.find(filter);
    
    res.json({ success: true, data: cvs });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// remove CV
const removeCV = async (req, res) => {
  console.log("entered remove function");
  
  try {
    const cv = await CVModel.findById(req.body.id);

    if (!cv) {
      return res.json({ success: false, message: "CV not found" });
    }

    if (cv.resume?.url) {
      
      fs.unlink(`${cv.resume.url}` , ()=>{})
    }

    await CVModel.findByIdAndDelete(req.body.id);
    res.json({ success: true, message: "CV Removed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

export { addCV, getCV, listCVs, removeCV };
