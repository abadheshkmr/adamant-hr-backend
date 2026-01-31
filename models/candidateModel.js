import mongoose from "mongoose";

/**
 * Candidate Model
 * 
 * Stores personal information of candidates (once per candidate, not per application)
 * This eliminates data duplication when a candidate applies to multiple jobs.
 * 
 * Key Features:
 * - Email is unique (one candidate record per email)
 * - Stores personal info: name, contact, address, education
 * - Timestamps track when candidate was created/updated
 */
const candidateSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  email: {
    type: String,
    required: true,
    unique: true,  // Email is unique per candidate
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
  },
  mobileNo: {
    type: String,
    required: true,
    trim: true,
    // Stored as digits only (10-15); + is added only for display. Allow optional + for backward compatibility.
    match: [/^\+?[0-9]{10,15}$/, "Please enter a valid mobile number (10-15 digits)"],
  },
  address: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  // Education details (candidate-level, not job-specific)
  // These represent the candidate's base qualifications
  tenthPercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  twelfthPercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  degree: {
    type: String,
    trim: true,
  },
  degreeCgpa: {
    type: Number,
    min: 0,
    max: 10,
  },
  // Firebase Auth UID - links candidate to Firebase user for portal login
  firebaseUid: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
  },
  // Primary resume (Firebase Storage) - used for dashboard download/upload
  resume: {
    storagePath: { type: String, trim: true },
    fileName: { type: String, trim: true },
    uploadedAt: { type: Date },
  },
  // Documents (PAN, AADHAR, marksheets) - stored in Firebase Storage
  documents: [{
    docType: { type: String, trim: true, required: true }, // 'PAN', 'AADHAR', 'marksheet'
    storagePath: { type: String, trim: true, required: true },
    fileName: { type: String, trim: true, required: true },
    uploadedAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true
});

// Indexes for efficient queries (firebaseUid has unique index from schema)
candidateSchema.index({ createdAt: -1 });

const CandidateModel = mongoose.models.candidates || mongoose.model("candidates", candidateSchema);

export default CandidateModel;
