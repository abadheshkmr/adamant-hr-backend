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
    match: [/^\+?[0-9]{7,15}$/, "Please enter a valid mobile number"],
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
  pinCode: {
    type: String,
    trim: true,
    match: [/^[0-9]{6}$/, "Pin code must be 6 digits"],
  },
  linkedinUrl: {
    type: String,
    trim: true,
    match: [/^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/, "Please enter a valid LinkedIn profile URL"],
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
}, {
  timestamps: true
});

// Indexes for efficient queries
// Note: email already has unique index from unique: true, so we don't need to add it again
candidateSchema.index({ createdAt: -1 }); // For sorting by registration date

const CandidateModel = mongoose.models.candidates || mongoose.model("candidates", candidateSchema);

export default CandidateModel;
