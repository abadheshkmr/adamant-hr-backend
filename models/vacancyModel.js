import mongoose from 'mongoose'

const vacancySchema = new mongoose.Schema({
    // Basic Information
    jobTitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    jobId: {
        type: Number,
        unique: true,
        required: true,
        index: true
    },
    
    // Industry Relationship (Reference to Industry)
    industry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'industries',
        required: false, // Optional for backward compatibility, will be required for new posts
        index: true
    },
    
    // Job Details
    description: {
        type: String,
        required: true,
        maxlength: 5000
    },
    qualification: {
        type: String,
        required: true,
        maxlength: 2000
    },
    skills: [{
        type: String,
        trim: true
    }], // Array of required skills
    
    // Location Information
    location: {
        city: {
            type: String,
            trim: true,
            index: true
        },
        state: {
            type: String,
            trim: true,
            index: true
        },
        country: {
            type: String,
            default: 'India',
            trim: true
        },
        isRemote: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    
    // Employment Details
    employmentType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
        default: 'Full-time',
        required: true,
        index: true
    },
    experienceLevel: {
        type: String,
        enum: ['Fresher', '0-2 years', '2-5 years', '5-10 years', '10+ years'],
        default: 'Fresher',
        index: true
    },
    
    // Compensation (Optional)
    salary: {
        min: {
            type: Number,
            min: 0
        },
        max: {
            type: Number,
            min: 0
        },
        currency: {
            type: String,
            default: 'INR'
        },
        isNegotiable: {
            type: Boolean,
            default: false
        }
    },
    
    // Application Details
    applicationDeadline: {
        type: Date
    },
    numberOfOpenings: {
        type: Number,
        default: 1,
        min: 1
    },
    
    // Status Management
    status: {
        type: String,
        enum: ['active', 'closed', 'draft'],
        default: 'active',
        index: true
    },
    
    // Metadata
    views: {
        type: Number,
        default: 0
    },
    applicationsCount: {
        type: Number,
        default: 0
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    publishedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
vacancySchema.index({ industry: 1, status: 1, createdAt: -1 }); // For filtered listings by industry
vacancySchema.index({ 'location.city': 1, status: 1 }); // For city filtering
vacancySchema.index({ employmentType: 1, status: 1 }); // For employment type filtering
vacancySchema.index({ experienceLevel: 1, status: 1 }); // For experience level filtering
vacancySchema.index({ status: 1, createdAt: -1 }); // For status-based queries
vacancySchema.index({ createdAt: -1 }); // For sorting by creation date
vacancySchema.index({ jobId: 1 }); // Already unique, but explicit index helps

const vacancyModel = mongoose.models.vacancies || mongoose.model("vacancies", vacancySchema);

export default vacancyModel;
