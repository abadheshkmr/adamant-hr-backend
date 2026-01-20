import mongoose from 'mongoose';

/**
 * Client Model
 * 
 * Stores client/company information for vacancies.
 * Allows admin to manage clients and associate them with vacancies.
 */
const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[0-9]{7,15}$/, "Please enter a valid phone number"]
  },
  address: {
    type: String,
    trim: true,
    maxlength: 500
  },
  website: {
    type: String,
    trim: true,
    maxlength: 200
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
// Note: name already has unique index from unique: true, so we don't need to add it again
clientSchema.index({ isActive: 1, createdAt: -1 }); // For active clients listing

const ClientModel = mongoose.models.clients || mongoose.model("clients", clientSchema);

export default ClientModel;
