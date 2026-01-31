import CandidateModel from "../models/candidateModel.js";
import ApplicationModel from "../models/applicationModel.js";
import fs from "fs";

/**
 * Add CV/Application
 * 
 * NEW LOGIC (Normalized):
 * 1. Find or create candidate by email
 * 2. Check if candidate already applied to this job
 * 3. Create application linked to candidate
 * 
 * This eliminates data duplication - same candidate applying to multiple jobs
 * only stores personal info once in candidates collection.
 */
const addCV = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.email || !req.body.jobId) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and Job ID are required" 
      });
    }

    // Normalize email and jobId
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const normalizedJobId = req.body.jobId.toString().trim();

    // Step 1: Find or create candidate
    // This is the key normalization step - we store personal info once per candidate
    let candidate = await CandidateModel.findOne({ email: normalizedEmail });
    
    if (!candidate) {
      // Create new candidate with personal information
      candidate = new CandidateModel({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: normalizedEmail,
        mobileNo: req.body.mobileNo,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        tenthPercentage: req.body.tenthPercentage ? parseFloat(req.body.tenthPercentage) : undefined,
        twelfthPercentage: req.body.twelfthPercentage ? parseFloat(req.body.twelfthPercentage) : undefined,
        degree: req.body.degree,
        degreeCgpa: req.body.degreeCgpa ? parseFloat(req.body.degreeCgpa) : undefined,
      });
      await candidate.save();
      console.log(`[${new Date().toISOString()}] Created new candidate: ${candidate.email}`);
    } else {
      // Candidate exists - update their info if provided (in case they moved, changed phone, etc.)
      const updates = {};
      if (req.body.firstName) updates.firstName = req.body.firstName;
      if (req.body.lastName) updates.lastName = req.body.lastName;
      if (req.body.mobileNo) updates.mobileNo = req.body.mobileNo;
      if (req.body.address) updates.address = req.body.address;
      if (req.body.city) updates.city = req.body.city;
      if (req.body.state) updates.state = req.body.state;
      // Update education if provided (candidate might have completed new degree)
      if (req.body.tenthPercentage !== undefined) updates.tenthPercentage = parseFloat(req.body.tenthPercentage);
      if (req.body.twelfthPercentage !== undefined) updates.twelfthPercentage = parseFloat(req.body.twelfthPercentage);
      if (req.body.degree) updates.degree = req.body.degree;
      if (req.body.degreeCgpa !== undefined) updates.degreeCgpa = parseFloat(req.body.degreeCgpa);
      
      if (Object.keys(updates).length > 0) {
        Object.assign(candidate, updates);
        await candidate.save();
        console.log(`[${new Date().toISOString()}] Updated candidate info: ${candidate.email}`);
      }
    }

    // Step 2: Check if application already exists (same candidate + same job)
    const existingApplication = await ApplicationModel.findOne({
      candidateId: candidate._id,
      jobId: normalizedJobId
    });

    if (existingApplication) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already applied to this job position. Please check your email or contact support if you believe this is an error." 
      });
    }

    // Step 3: Handle resume and cover letter files (multer .fields() gives req.files)
    const resumeFile = req.files?.resume?.[0];
    const coverLetterFile = req.files?.coverLetter?.[0];
    if (!resumeFile) {
      return res.status(400).json({ success: false, message: "Resume is required" });
    }
    const resumeUrl = resumeFile.path || `uploads/resumes/${resumeFile.filename}`;
    const coverLetterUrl = coverLetterFile ? (coverLetterFile.path || `uploads/coverLetters/${coverLetterFile.filename}`) : null;

    // Step 4: Create application (linked to candidate)
    const application = new ApplicationModel({
      candidateId: candidate._id,
      jobId: normalizedJobId,
      resume: { url: resumeUrl },
      coverLetter: coverLetterUrl ? { url: coverLetterUrl } : {},
      status: 'pending',
      appliedAt: new Date()
    });

    await application.save();
    console.log(`[${new Date().toISOString()}] Created application: Candidate ${candidate.email} applied to Job ${normalizedJobId}`);

    res.status(200).json({ 
      success: true, 
      message: "Application submitted successfully" 
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Add CV Error:`, error);
    console.error('Error stack:', error.stack);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      // Check if it's candidate email duplicate (shouldn't happen with our logic, but handle it)
      if (error.keyPattern && error.keyPattern.email === 1) {
        // This means candidate was created between our check and save - retry
        return res.status(500).json({ 
          success: false, 
          message: "An error occurred. Please try again." 
        });
      }
      
      // It's the compound index error (candidateId + jobId) - candidate already applied
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

/**
 * Get CV/Application by ID
 * 
 * Returns application with populated candidate data
 */
const getCV = async (req, res) => {
  try {
    const application = await ApplicationModel.findById(req.params.id)
      .populate('candidateId', 'firstName lastName email mobileNo address city state tenthPercentage twelfthPercentage degree degreeCgpa');
    
    if (!application) {
      return res.json({ success: false, message: "Application not found" });
    }
    
    res.json({ success: true, data: application });
  } catch (error) {
    console.log(`[${new Date().toISOString()}] Get CV Error:`, error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * List all CVs/Applications
 * 
 * Enhanced filtering:
 * - jobId, candidateId, status
 * - Date range (appliedDateFrom, appliedDateTo)
 * - Location (city, state)
 * - Education (degree, minCgpa)
 * - Sort options
 * Supports pagination
 * Returns applications with populated candidate data
 */
const listCVs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Default 10 per page
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'appliedAt'; // appliedAt, createdAt, status
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    const filter = {};
    
    // Application-level filters
    if (req.query.jobId) filter.jobId = req.query.jobId;
    if (req.query.candidateId) filter.candidateId = req.query.candidateId;
    if (req.query.status) filter.status = req.query.status;
    
    // Date range filter
    if (req.query.appliedDateFrom || req.query.appliedDateTo) {
      filter.appliedAt = {};
      if (req.query.appliedDateFrom) {
        filter.appliedAt.$gte = new Date(req.query.appliedDateFrom);
      }
      if (req.query.appliedDateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(req.query.appliedDateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.appliedAt.$lte = endDate;
      }
    }
    
    // Build sort object
    let sortObj = {};
    if (sortBy === 'appliedAt' || sortBy === 'createdAt') {
      sortObj[sortBy] = sortOrder;
    } else if (sortBy === 'status') {
      sortObj.status = sortOrder;
    } else {
      sortObj.appliedAt = -1; // Default
    }
    
    // Get total count with filters
    const total = await ApplicationModel.countDocuments(filter);
    
    // Fetch with pagination
    let applications = await ApplicationModel.find(filter)
      .populate('candidateId', 'firstName lastName email mobileNo address city state tenthPercentage twelfthPercentage degree degreeCgpa')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Apply candidate-level filters (after populate, since we need candidate data)
    if (req.query.city || req.query.state || req.query.degree || req.query.minCgpa) {
      applications = applications.filter(app => {
        const candidate = app.candidateId;
        if (!candidate) return false;
        
        // City filter
        if (req.query.city) {
          const candidateCity = (candidate.city || '').toLowerCase();
          const filterCity = req.query.city.toLowerCase();
          if (!candidateCity.includes(filterCity)) return false;
        }
        
        // State filter
        if (req.query.state) {
          const candidateState = (candidate.state || '').toLowerCase();
          const filterState = req.query.state.toLowerCase();
          if (!candidateState.includes(filterState)) return false;
        }
        
        // Degree filter
        if (req.query.degree) {
          const candidateDegree = (candidate.degree || '').toLowerCase();
          const filterDegree = req.query.degree.toLowerCase();
          if (!candidateDegree.includes(filterDegree)) return false;
        }
        
        // CGPA filter
        if (req.query.minCgpa) {
          const minCgpa = parseFloat(req.query.minCgpa);
          const candidateCgpa = candidate.degreeCgpa || 0;
          if (candidateCgpa < minCgpa) return false;
        }
        
        return true;
      });
    }
    
    res.json({ 
      success: true, 
      data: applications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.log(`[${new Date().toISOString()}] List CVs Error:`, error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * List all Candidates
 * 
 * Enhanced filtering:
 * - Location (city, state)
 * - Education (degree, minCgpa, maxCgpa)
 * - Application count range (minApplications, maxApplications)
 * - Sort options
 * Supports pagination
 * NEW ENDPOINT for normalized structure
 */
const listCandidates = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Default 10 per page
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt'; // createdAt, name, email
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    // Build candidate filter
    const candidateFilter = {};
    
    if (req.query.city) {
      candidateFilter.city = new RegExp(req.query.city, 'i');
    }
    if (req.query.state) {
      candidateFilter.state = new RegExp(req.query.state, 'i');
    }
    if (req.query.degree) {
      candidateFilter.degree = new RegExp(req.query.degree, 'i');
    }
    if (req.query.minCgpa) {
      candidateFilter.degreeCgpa = { $gte: parseFloat(req.query.minCgpa) };
    }
    if (req.query.maxCgpa) {
      if (!candidateFilter.degreeCgpa) candidateFilter.degreeCgpa = {};
      candidateFilter.degreeCgpa.$lte = parseFloat(req.query.maxCgpa);
    }
    
    // Build sort object
    let sortObj = {};
    if (sortBy === 'createdAt' || sortBy === 'email') {
      sortObj[sortBy] = sortOrder;
    } else if (sortBy === 'name') {
      sortObj.firstName = sortOrder;
      sortObj.lastName = sortOrder;
    } else {
      sortObj.createdAt = -1; // Default
    }
    
    // Get total count
    const total = await CandidateModel.countDocuments(candidateFilter);
    
    // Fetch candidates with pagination
    let candidates = await CandidateModel.find(candidateFilter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get application count for each candidate
    let candidatesWithCounts = await Promise.all(
      candidates.map(async (candidate) => {
        const applicationCount = await ApplicationModel.countDocuments({ 
          candidateId: candidate._id 
        });
        return {
          ...candidate,
          applicationCount
        };
      })
    );
    
    // Filter by application count range (after getting counts)
    if (req.query.minApplications || req.query.maxApplications) {
      candidatesWithCounts = candidatesWithCounts.filter(candidate => {
        const count = candidate.applicationCount || 0;
        if (req.query.minApplications && count < parseInt(req.query.minApplications)) {
          return false;
        }
        if (req.query.maxApplications && count > parseInt(req.query.maxApplications)) {
          return false;
        }
        return true;
      });
    }
    
    res.json({ 
      success: true, 
      data: candidatesWithCounts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.log(`[${new Date().toISOString()}] List Candidates Error:`, error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * Get Candidate by ID with all their applications
 * 
 * Returns candidate with populated applications
 * NEW ENDPOINT for normalized structure
 */
const getCandidate = async (req, res) => {
  try {
    const candidate = await CandidateModel.findById(req.params.id);
    
    if (!candidate) {
      return res.json({ success: false, message: "Candidate not found" });
    }
    
    // Get all applications for this candidate
    const applications = await ApplicationModel.find({ candidateId: candidate._id })
      .sort({ appliedAt: -1 })
      .lean();
    
    res.json({ 
      success: true, 
      data: {
        candidate,
        applications
      }
    });
  } catch (error) {
    console.log(`[${new Date().toISOString()}] Get Candidate Error:`, error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * Update Application Status
 * 
 * Allows admin to update application status (pending, shortlisted, rejected, hired)
 * NEW ENDPOINT for normalized structure
 */
const updateApplicationStatus = async (req, res) => {
  try {
    const { id, status, notes } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({ 
        success: false, 
        message: "Application ID and status are required" 
      });
    }
    
    const validStatuses = ['pending', 'shortlisted', 'rejected', 'hired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    const updateData = { status };
    if (notes !== undefined) updateData.notes = notes;
    
    const application = await ApplicationModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('candidateId', 'firstName lastName email');
    
    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Application status updated successfully",
      data: application
    });
  } catch (error) {
    console.log(`[${new Date().toISOString()}] Update Application Status Error:`, error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating application status" 
    });
  }
};

/**
 * Remove CV/Application
 * 
 * Deletes application and associated resume file
 * Note: Candidate record is NOT deleted (they may have other applications)
 */
const removeCV = async (req, res) => {
  console.log(`[${new Date().toISOString()}] Remove CV called`);
  
  try {
    const application = await ApplicationModel.findById(req.body.id);

    if (!application) {
      return res.json({ success: false, message: "Application not found" });
    }

    // Delete resume and cover letter files if they exist
    if (application.resume?.url) {
      fs.unlink(application.resume.url, (err) => {
        if (err) console.error(`Error deleting file ${application.resume.url}:`, err);
      });
    }
    if (application.coverLetter?.url) {
      fs.unlink(application.coverLetter.url, (err) => {
        if (err) console.error(`Error deleting file ${application.coverLetter.url}:`, err);
      });
    }

    // Delete application (candidate record remains)
    await ApplicationModel.findByIdAndDelete(req.body.id);
    
    console.log(`[${new Date().toISOString()}] Application deleted: ${req.body.id}`);
    res.json({ success: true, message: "Application Removed" });
  } catch (error) {
    console.log(`[${new Date().toISOString()}] Remove CV Error:`, error);
    res.json({ success: false, message: "Error" });
  }
};

export { addCV, getCV, listCVs, listCandidates, getCandidate, updateApplicationStatus, removeCV };
