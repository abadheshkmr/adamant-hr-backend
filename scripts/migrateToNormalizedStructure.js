/**
 * Migration Script: Normalize CV Data Structure
 * 
 * This script migrates existing CV data to the new normalized structure:
 * 1. Groups CVs by email to identify unique candidates
 * 2. Creates candidate records (one per unique email)
 * 3. Creates application records linked to candidates
 * 4. Preserves all existing data
 * 
 * IMPORTANT: 
 * - Backup your database before running this script
 * - This script is idempotent (safe to run multiple times)
 * - Old CV collection is NOT deleted (for safety)
 * 
 * Run: node scripts/migrateToNormalizedStructure.js
 */

import mongoose from 'mongoose';
import 'dotenv/config';
import CVModel from '../models/cvModel.js';
import CandidateModel from '../models/candidateModel.js';
import ApplicationModel from '../models/applicationModel.js';

const migrateToNormalizedStructure = async () => {
  try {
    console.log('🔄 Starting migration to normalized structure...\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Get all existing CVs
    console.log('📋 Fetching existing CVs...');
    const existingCVs = await CVModel.find({}).lean();
    console.log(`   Found ${existingCVs.length} CV records\n`);

    if (existingCVs.length === 0) {
      console.log('✅ No CVs to migrate. Database is already empty or migrated.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Step 2: Group CVs by email to identify unique candidates
    console.log('👥 Grouping CVs by email to identify unique candidates...');
    const candidatesMap = new Map(); // email -> { candidate data, applications: [] }
    
    existingCVs.forEach(cv => {
      const email = cv.email.toLowerCase().trim();
      
      if (!candidatesMap.has(email)) {
        // First CV for this email - create candidate entry
        candidatesMap.set(email, {
          candidateData: {
            firstName: cv.firstName,
            lastName: cv.lastName,
            email: email,
            mobileNo: cv.mobileNo,
            address: cv.address,
            city: cv.city,
            state: cv.state,
            tenthPercentage: cv.tenthPercentage,
            twelfthPercentage: cv.twelfthPercentage,
            degree: cv.degree,
            degreeCgpa: cv.degreeCgpa,
            createdAt: cv.createdAt, // Preserve original creation date
            updatedAt: cv.updatedAt
          },
          applications: []
        });
      }
      
      // Add this CV as an application
      candidatesMap.get(email).applications.push({
        jobId: cv.jobId,
        resume: cv.resume,
        appliedAt: cv.createdAt, // Use CV creation date as application date
        createdAt: cv.createdAt,
        updatedAt: cv.updatedAt
      });
    });

    console.log(`   Found ${candidatesMap.size} unique candidates\n`);

    // Step 3: Check if candidates already exist
    console.log('🔍 Checking for existing candidates...');
    const existingCandidates = await CandidateModel.find({}).select('email').lean();
    const existingEmails = new Set(existingCandidates.map(c => c.email.toLowerCase()));
    console.log(`   Found ${existingEmails.size} existing candidates\n`);

    // Step 4: Create candidate records
    console.log('👤 Creating candidate records...');
    let candidatesCreated = 0;
    let candidatesSkipped = 0;
    const candidateIdMap = new Map(); // email -> candidateId

    for (const [email, data] of candidatesMap.entries()) {
      if (existingEmails.has(email)) {
        // Candidate already exists - get their ID
        const existingCandidate = await CandidateModel.findOne({ email: email });
        candidateIdMap.set(email, existingCandidate._id);
        candidatesSkipped++;
        console.log(`   ⏭️  Skipped existing candidate: ${email}`);
      } else {
        // Create new candidate
        try {
          const candidate = new CandidateModel(data.candidateData);
          await candidate.save();
          candidateIdMap.set(email, candidate._id);
          candidatesCreated++;
          console.log(`   ✅ Created candidate: ${email} (${data.applications.length} application(s))`);
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key - candidate was created between check and save
            const existingCandidate = await CandidateModel.findOne({ email: email });
            candidateIdMap.set(email, existingCandidate._id);
            candidatesSkipped++;
            console.log(`   ⏭️  Candidate already exists (race condition): ${email}`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log(`\n   📊 Summary: ${candidatesCreated} created, ${candidatesSkipped} skipped\n`);

    // Step 5: Check for existing applications
    console.log('🔍 Checking for existing applications...');
    const existingApplications = await ApplicationModel.find({}).select('candidateId jobId').lean();
    const existingAppKeys = new Set(
      existingApplications.map(app => `${app.candidateId.toString()}_${app.jobId}`)
    );
    console.log(`   Found ${existingAppKeys.size} existing applications\n`);

    // Step 6: Create application records
    console.log('📝 Creating application records...');
    let applicationsCreated = 0;
    let applicationsSkipped = 0;

    for (const [email, data] of candidatesMap.entries()) {
      const candidateId = candidateIdMap.get(email);
      
      for (const appData of data.applications) {
        const appKey = `${candidateId.toString()}_${appData.jobId}`;
        
        if (existingAppKeys.has(appKey)) {
          applicationsSkipped++;
          console.log(`   ⏭️  Skipped existing application: ${email} -> Job ${appData.jobId}`);
        } else {
          try {
            const application = new ApplicationModel({
              candidateId: candidateId,
              jobId: appData.jobId,
              resume: appData.resume,
              appliedAt: appData.appliedAt,
              status: 'pending',
              createdAt: appData.createdAt,
              updatedAt: appData.updatedAt
            });
            await application.save();
            applicationsCreated++;
            console.log(`   ✅ Created application: ${email} -> Job ${appData.jobId}`);
          } catch (error) {
            if (error.code === 11000) {
              // Duplicate key - application was created between check and save
              applicationsSkipped++;
              console.log(`   ⏭️  Application already exists (race condition): ${email} -> Job ${appData.jobId}`);
            } else {
              throw error;
            }
          }
        }
      }
    }

    console.log(`\n   📊 Summary: ${applicationsCreated} created, ${applicationsSkipped} skipped\n`);

    // Step 7: Verification
    console.log('✅ Verification...');
    const totalCandidates = await CandidateModel.countDocuments();
    const totalApplications = await ApplicationModel.countDocuments();
    
    console.log(`   Total candidates: ${totalCandidates}`);
    console.log(`   Total applications: ${totalApplications}`);
    console.log(`   Original CVs: ${existingCVs.length}\n`);

    // Step 8: Summary
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Candidates created: ${candidatesCreated}`);
    console.log(`   ⏭️  Candidates skipped: ${candidatesSkipped}`);
    console.log(`   ✅ Applications created: ${applicationsCreated}`);
    console.log(`   ⏭️  Applications skipped: ${applicationsSkipped}`);
    console.log(`\n   💡 Note: Original CV collection is preserved for safety.`);
    console.log(`   💡 You can delete it after verifying the migration.\n`);

    console.log('✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run migration
migrateToNormalizedStructure();
