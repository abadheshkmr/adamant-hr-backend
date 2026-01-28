# Local File Organization Implementation

## Overview
This implementation organizes job application resumes into a structured folder hierarchy on the local filesystem, matching the recommended Google Drive structure. This allows easy migration to Google Drive later.

## Folder Structure

```
uploads/
└── applications/
    └── 2024/
        ├── Job-123-Software-Engineer/
        │   ├── 01-Pending/
        │   │   ├── 2024-01-15_John-Doe_john.doe@email.com.pdf
        │   │   └── 2024-01-16_Jane-Smith_jane.smith@email.com.pdf
        │   ├── 02-Shortlisted/
        │   │   └── 2024-01-17_Mike-Johnson_mike.j@email.com.pdf
        │   ├── 03-Rejected/
        │   └── 04-Hired/
        │       └── 2024-01-20_Sarah-Williams_sarah.w@email.com.pdf
        ├── Job-124-Data-Analyst/
        │   └── ...
        └── Job-125-Product-Manager/
            └── ...
```

## File Naming Convention

Format: `YYYY-MM-DD_Candidate-Name_email@domain.com.pdf`

Example: `2024-01-15_John-Doe_john.doe@email.com.pdf`

- **Date**: Application submission date (YYYY-MM-DD)
- **Candidate Name**: Sanitized name (spaces → hyphens, special chars removed)
- **Email**: Candidate email (for quick identification)
- **Extension**: Original file extension (.pdf, .doc, .docx)

## Implementation Details

### 1. File Manager Utility (`utils/fileManager.js`)

**Key Functions:**
- `ensureFolderStructure()` - Creates folder structure if it doesn't exist
- `moveToOrganizedLocation()` - Moves uploaded file to organized location
- `moveFileOnStatusChange()` - Moves file when application status changes
- `deleteFile()` - Deletes file when application is removed
- `generateFileName()` - Creates standardized filename
- `sanitizeName()` - Cleans folder/file names for filesystem compatibility

### 2. Updated CV Controller (`controllers/cvController.js`)

**Changes:**
- Fetches vacancy details to get `jobTitle` for folder naming
- Moves uploaded files to organized structure immediately after upload
- Updates file location when application status changes
- Uses fileManager for file deletion

### 3. Server Configuration (`server.js`)

**Added:**
- Static route for applications folder: `/uploads/applications`

## How It Works

### When Application is Submitted:
1. File is uploaded to temporary location: `uploads/resumes/timestamp-filename.pdf`
2. System fetches vacancy details (jobId, jobTitle)
3. File is moved to: `uploads/applications/2024/Job-123-Software-Engineer/01-Pending/2024-01-15_John-Doe_email.pdf`
4. Database stores relative path: `applications/2024/Job-123-Software-Engineer/01-Pending/2024-01-15_John-Doe_email.pdf`

### When Status Changes:
1. Admin updates status (e.g., pending → shortlisted)
2. System moves file from `01-Pending/` to `02-Shortlisted/`
3. Database is updated with new file path
4. File preserves original filename format

### When Application is Deleted:
1. System deletes file from organized location
2. Application record is removed from database
3. Candidate record remains (they may have other applications)

## Benefits

✅ **Organized Structure**: Easy to find applications by job
✅ **Status Management**: Files automatically organized by status
✅ **Year-based**: Simple archiving by year
✅ **Scalable**: Works with many jobs and applications
✅ **Migration Ready**: Same structure can be used for Google Drive
✅ **Backward Compatible**: Old files in `uploads/resumes/` still work

## Migration Path to Google Drive

When ready to migrate to Google Drive:

1. **Keep same folder structure** - The fileManager can be extended with Google Drive API
2. **Update fileManager methods** - Replace `fs.renameSync()` with Google Drive API calls
3. **No database changes needed** - Just update file paths to Google Drive URLs
4. **Gradual migration** - Can migrate files incrementally

## Testing

To test the implementation:

1. **Submit an application** - File should be organized automatically
2. **Change application status** - File should move to new status folder
3. **Delete application** - File should be removed
4. **Check folder structure** - Verify files are in correct locations

## File Access URLs

Files are accessible via:
- `http://localhost:4000/uploads/applications/2024/Job-123-Software-Engineer/01-Pending/filename.pdf`

The admin panel will automatically use the correct path from the database.
