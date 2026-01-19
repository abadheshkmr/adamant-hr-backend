/**
 * Migration Script: Update CV Collection Indexes
 * 
 * This script:
 * 1. Drops the old unique index on 'email' field (if it exists)
 * 2. Creates a new compound unique index on 'email + jobId'
 * 
 * Run this script before deploying the updated code:
 * node scripts/migrateCVIndex.js
 */

import mongoose from 'mongoose';
import 'dotenv/config';

const migrateCVIndexes = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('cvs');

    // Step 1: Check existing indexes
    console.log('\n📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    // Step 2: Drop old unique index on 'email' if it exists
    const emailIndex = indexes.find(idx => 
      idx.key && idx.key.email === 1 && idx.unique === true && Object.keys(idx.key).length === 1
    );

    if (emailIndex) {
      console.log(`\n🗑️  Dropping old unique index: ${emailIndex.name}`);
      try {
        await collection.dropIndex(emailIndex.name);
        console.log(`✅ Successfully dropped index: ${emailIndex.name}`);
      } catch (error) {
        if (error.code === 27) {
          console.log(`⚠️  Index ${emailIndex.name} does not exist (might have been dropped already)`);
        } else {
          throw error;
        }
      }
    } else {
      console.log('\n✅ No old unique index on email found');
    }

    // Step 3: Check if compound index already exists
    const compoundIndex = indexes.find(idx => 
      idx.key && 
      idx.key.email === 1 && 
      idx.key.jobId === 1 && 
      idx.unique === true &&
      Object.keys(idx.key).length === 2
    );

    if (compoundIndex) {
      console.log(`\n✅ Compound index already exists: ${compoundIndex.name}`);
    } else {
      // Step 4: Create compound unique index on email + jobId
      console.log('\n📝 Creating compound unique index on email + jobId...');
      await collection.createIndex(
        { email: 1, jobId: 1 },
        { 
          unique: true,
          name: 'email_1_jobId_1'
        }
      );
      console.log('✅ Successfully created compound unique index on email + jobId');
    }

    // Step 5: Verify final indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Old unique index on email: Removed');
    console.log('  - New compound unique index on email + jobId: Created');
    console.log('  - Users can now apply to multiple jobs with the same email');
    console.log('  - Users cannot apply twice to the same job');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run migration
migrateCVIndexes();
