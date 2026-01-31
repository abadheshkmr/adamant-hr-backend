import mongoose from 'mongoose';

const recruiterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 320,
  },
  photo: {
    type: String,
    trim: true,
    default: '',
  },
  title: {
    type: String,
    trim: true,
    maxlength: 200,
    default: 'Recruiter',
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 30,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

const recruiterModel = mongoose.models.recruiters || mongoose.model('recruiters', recruiterSchema);
export default recruiterModel;
