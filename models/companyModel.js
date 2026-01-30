import mongoose from 'mongoose';

/**
 * Company Model
 *
 * Stores company profile info for the "Company Info" section on job pages.
 * - Can be standalone (e.g. Adamant HR) or linked to a Client.
 * - Vacancy can reference a Company directly, or inherit from Client's company.
 */
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    founded: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    employees: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    logo: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    benefits: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    culture: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

companySchema.index({ isActive: 1, name: 1 });

const CompanyModel = mongoose.models.companies || mongoose.model('companies', companySchema);

export default CompanyModel;
