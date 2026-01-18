import mongoose from "mongoose";

const resumeSubSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },          // file path / cloud URL
    data: { type: Buffer },                     // optional binary
    contentType: { type: String, trim: true },  // e.g. 'application/pdf'
  },
  { _id: false }
);

const cvSchema = new mongoose.Schema(
  {
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
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
      unique:true,
    },
    address: {
      type: String,
      trim: true,
    },
    mobileNo: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, "Please enter a valid mobile number"],
    },
    jobId: {
      type: String,
      required: true,
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
    resume: {
      type: resumeSubSchema,
      default: {},
    },
  },
  { timestamps: true }
);

// Correct way to get or create the model
const CVModel = mongoose.models.CV || mongoose.model("CV", cvSchema);

export default CVModel;
