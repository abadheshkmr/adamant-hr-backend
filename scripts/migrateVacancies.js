import mongoose from 'mongoose';
import vacancyModel from '../models/vacancyModel.js';
import 'dotenv/config';

const migrateVacancies = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.URI);
    console.log('Connected to MongoDB');

    // Find all existing vacancies
    const vacancies = await vacancyModel.find({});
    console.log(`Found ${vacancies.length} vacancies to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const vacancy of vacancies) {
      const updateData = {};

      // Set default values for new fields if they don't exist
      if (!vacancy.status) {
        updateData.status = 'active';
      }

      if (!vacancy.publishedAt && vacancy.status === 'active') {
        updateData.publishedAt = vacancy.createdAt || new Date();
      }

      if (!vacancy.employmentType) {
        updateData.employmentType = 'Full-time';
      }

      if (!vacancy.experienceLevel) {
        updateData.experienceLevel = 'Fresher';
      }

      if (!vacancy.location) {
        updateData.location = {
          city: '',
          state: '',
          country: 'India',
          isRemote: false
        };
      }

      if (!vacancy.numberOfOpenings) {
        updateData.numberOfOpenings = 1;
      }

      if (!vacancy.skills) {
        updateData.skills = [];
      }

      if (!vacancy.views) {
        updateData.views = 0;
      }

      if (!vacancy.applicationsCount) {
        updateData.applicationsCount = 0;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        await vacancyModel.findByIdAndUpdate(vacancy._id, updateData);
        migrated++;
        console.log(`Migrated vacancy: ${vacancy.jobTitle} (Job ID: ${vacancy.jobId})`);
      } else {
        skipped++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total vacancies: ${vacancies.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (already migrated): ${skipped}`);
    console.log('\nNote: Industry field is set to null for existing vacancies.');
    console.log('Admin must manually assign industries to existing vacancies.');

    // Close connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error migrating vacancies:', error);
    process.exit(1);
  }
};

migrateVacancies();
