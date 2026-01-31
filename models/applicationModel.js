import mongoose from "mongoose";

/**
 * Application Model (replaces CV Model)
 * 
 * Stores job-specific application data with reference to candidate.
 * This is the normalized approach - one candidate can have multiple applications.
 * 
 * Key Features:
 * - References candidate via candidateId (no duplicate personal data)
 * - Stores job-specific data: jobId, resume, status, notes
 * - Compound unique index prevents duplicate applications (same candidate + same job)
 */
const fileAttachmentSubSchema = new mongoose.Schema({
  url: { type: String, trim: true },
  data: { type: Buffer },
  contentType: { type: String, trim: true },
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'candidates',
    required: true,
    index: true
  },
  jobId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  resume: {
    type: fileAttachmentSubSchema,
    default: {},
  },
  coverLetter: {
    type: fileAttachmentSubSchema,
    default: {},
  },
  // Job-specific education details (optional - if job requires different info than candidate's base)
  // Most jobs will use candidate's base education, but some might need job-specific details
  jobSpecificEducation: {
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
  },
  status: {
    type: String,
    enum: ['pending', 'shortlisted', 'rejected', 'hired'],
    default: 'pending',
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  appliedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound unique index: same candidate can't apply twice to same job
applicationSchema.index({ candidateId: 1, jobId: 1 }, { unique: true });

// Indexes for common queries
applicationSchema.index({ jobId: 1, status: 1 }); // Filter applications by job and status
applicationSchema.index({ candidateId: 1, appliedAt: -1 }); // Get candidate's application history
applicationSchema.index({ status: 1, appliedAt: -1 }); // Filter by status

const ApplicationModel = mongoose.models.applications || mongoose.model("applications", applicationSchema);

export default ApplicationModel;
