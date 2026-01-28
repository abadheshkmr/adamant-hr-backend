# Database Normalization Migration Guide

## Overview

This document explains the migration from the old CV structure to a normalized database design that eliminates data duplication when candidates apply to multiple jobs.

## What Changed?

### Old Structure (Before)
- **Single Collection**: `cvs`
- **Problem**: When a candidate applied to multiple jobs, all their personal information (name, email, address, education) was duplicated for each application.

### New Structure (After)
- **Two Collections**: 
  - `candidates` - Stores personal information once per candidate (unique by email)
  - `applications` - Stores job-specific application data with reference to candidate

### Benefits
1. **No Data Duplication**: Personal information stored once per candidate
2. **Data Consistency**: Update candidate info once, applies to all their applications
3. **Better Analytics**: Easy to see all applications by a single candidate
4. **Scalability**: More efficient storage and queries

## Database Schema

### Candidates Collection
```javascript
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String (unique),
  mobileNo: String,
  address: String,
  city: String,
  state: String,
  tenthPercentage: Number,
  twelfthPercentage: Number,
  degree: String,
  degreeCgpa: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Applications Collection
```javascript
{
  _id: ObjectId,
  candidateId: ObjectId (ref: 'candidates'),
  jobId: String,
  resume: {
    url: String,
    data: Buffer,
    contentType: String
  },
  status: String ('pending' | 'shortlisted' | 'rejected' | 'hired'),
  notes: String,
  appliedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Index**: `{ candidateId: 1, jobId: 1 }` - Prevents duplicate applications

## Migration Steps

### Prerequisites
1. **Backup your database** before running migration
2. Ensure MongoDB connection string is set in `.env` file
3. Stop the backend server during migration (optional, but recommended)

### Step 1: Run Migration Script

```bash
cd hr-backend
npm run migrate:normalize
```

### What the Script Does
1. Fetches all existing CVs from the `cvs` collection
2. Groups CVs by email to identify unique candidates
3. Creates candidate records (one per unique email)
4. Creates application records linked to candidates
5. Preserves all existing data (creation dates, etc.)
6. **Does NOT delete** the old `cvs` collection (for safety)

### Step 2: Verify Migration

After migration, verify:
- Total candidates created = unique emails in old CVs
- Total applications created = total CVs in old collection
- Check a few sample records to ensure data integrity

### Step 3: Test Application Flow

1. Test submitting a new application (should create candidate + application)
2. Test submitting another application with same email (should reuse candidate)
3. Test duplicate application prevention (same email + same jobId should fail)

### Step 4: Cleanup (Optional)

After verifying everything works:
```javascript
// In MongoDB shell or Compass
db.cvs.drop()  // Delete old collection (ONLY after verification)
```

## Code Changes

### Backend Changes

1. **New Models**:
   - `models/candidateModel.js` - Candidate schema
   - `models/applicationModel.js` - Application schema (replaces cvModel)

2. **Updated Controller** (`controllers/cvController.js`):
   - `addCV`: Finds/creates candidate, then creates application
   - `getCV`: Returns application with populated candidate data
   - `listCVs`: Returns applications with populated candidate data
   - `removeCV`: Deletes application (candidate remains)

3. **Updated Routes** (`routes/cvRoute.js`):
   - Updated duplicate check to use new models
   - Same API endpoints (backward compatible)

### Frontend Changes

**No changes required!** The frontend form submission remains the same. The backend handles the normalization automatically.

### Admin Panel Changes

**Updated** (`hr-admin/src/pages/Applicants/Applicants.jsx`):
- Accesses candidate data via `applicant.candidateId` (populated by backend)
- Displays application status and applied date
- Backward compatible (falls back to old structure if needed)

## API Response Changes

### Before (Old Structure)
```json
{
  "success": true,
  "data": [{
    "_id": "...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "jobId": "20",
    "resume": {...}
  }]
}
```

### After (Normalized Structure)
```json
{
  "success": true,
  "data": [{
    "_id": "...",
    "candidateId": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "mobileNo": "...",
      "address": "...",
      ...
    },
    "jobId": "20",
    "resume": {...},
    "status": "pending",
    "appliedAt": "2024-01-15T10:00:00Z"
  }]
}
```

## Rollback Plan

If you need to rollback:

1. **Stop using new models**: Revert to `cvModel.js`
2. **Revert controller**: Use old `cvController.js` logic
3. **Data**: Old `cvs` collection is preserved (if not deleted)

## Troubleshooting

### Error: "Candidate already exists"
- This is normal during migration if script runs multiple times
- Script is idempotent - safe to re-run

### Error: "Application already exists"
- Check if duplicate applications exist in old data
- Migration script handles this gracefully

### Admin panel shows "N/A" for candidate fields
- Check if backend is populating `candidateId` correctly
- Verify API response includes populated candidate data

## Support

For issues or questions:
1. Check backend logs for detailed error messages
2. Verify MongoDB connection and permissions
3. Ensure all dependencies are installed (`npm install`)
