import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File Manager Utility
 * 
 * Manages organized file storage for job applications
 * Structure: Applications/YYYY/Job-{jobId}-{jobTitle}/01-Pending/
 */
class FileManager {
  constructor() {
    this.baseDir = path.join(__dirname, '..', 'uploads', 'applications');
    this.ensureBaseDirectory();
  }

  /**
   * Ensure base directory exists
   */
  ensureBaseDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Sanitize string for folder/file names
   * Removes special characters and replaces spaces with hyphens
   */
  sanitizeName(name) {
    if (!name) return '';
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  /**
   * Get status folder name (numbered for sorting)
   */
  getStatusFolder(status) {
    const statusMap = {
      'pending': '01-Pending',
      'shortlisted': '02-Shortlisted',
      'rejected': '03-Rejected',
      'hired': '04-Hired'
    };
    return statusMap[status] || '01-Pending';
  }

  /**
   * Build folder path for a job application
   * Structure: Applications/YYYY/Job-{jobId}-{jobTitle}/{statusFolder}/
   */
  buildFolderPath(jobId, jobTitle, year, status = 'pending') {
    const sanitizedTitle = this.sanitizeName(jobTitle);
    const statusFolder = this.getStatusFolder(status);
    const jobFolder = `Job-${jobId}-${sanitizedTitle}`;
    
    return path.join(
      this.baseDir,
      year.toString(),
      jobFolder,
      statusFolder
    );
  }

  /**
   * Ensure folder structure exists
   */
  ensureFolderStructure(jobId, jobTitle, year, status = 'pending') {
    const folderPath = this.buildFolderPath(jobId, jobTitle, year, status);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    return folderPath;
  }

  /**
   * Generate filename for resume
   * Format: YYYY-MM-DD_Candidate-Name_email@domain.com.pdf
   */
  generateFileName(candidateName, email, fileExtension) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedName = this.sanitizeName(candidateName);
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, ''); // Keep email-safe chars
    
    // Limit name length to avoid too long filenames
    const namePart = sanitizedName.substring(0, 30);
    const emailPart = sanitizedEmail.substring(0, 30);
    
    return `${dateStr}_${namePart}_${emailPart}${fileExtension}`;
  }

  /**
   * Move file from old location to new organized location
   */
  moveToOrganizedLocation(oldFilePath, jobId, jobTitle, candidateName, email, status = 'pending') {
    try {
      // Convert relative path to absolute if needed
      const absoluteOldPath = path.isAbsolute(oldFilePath) 
        ? oldFilePath 
        : path.join(__dirname, '..', oldFilePath);
      
      // Check if old file exists
      if (!fs.existsSync(absoluteOldPath)) {
        throw new Error(`Source file not found: ${absoluteOldPath}`);
      }

      const year = new Date().getFullYear();
      const folderPath = this.ensureFolderStructure(jobId, jobTitle, year, status);
      
      // Get file extension from old file
      const fileExtension = path.extname(absoluteOldPath);
      const fileName = this.generateFileName(candidateName, email, fileExtension);
      
      const newFilePath = path.join(folderPath, fileName);
      
      // Handle duplicate filenames by adding timestamp
      let finalPath = newFilePath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const nameWithoutExt = path.basename(newFilePath, fileExtension);
        finalPath = path.join(folderPath, `${nameWithoutExt}_${counter}${fileExtension}`);
        counter++;
      }
      
      // Move file
      fs.renameSync(absoluteOldPath, finalPath);
      
      // Return relative path from uploads directory
      const relativePath = path.relative(path.join(__dirname, '..', 'uploads'), finalPath);
      return relativePath.replace(/\\/g, '/'); // Normalize path separators
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FileManager Error:`, error);
      throw error;
    }
  }

  /**
   * Move file when application status changes
   */
  moveFileOnStatusChange(oldFilePath, jobId, jobTitle, candidateName, email, oldStatus, newStatus) {
    try {
      // Convert relative path to absolute if needed
      const absoluteOldPath = path.isAbsolute(oldFilePath) 
        ? oldFilePath 
        : path.join(__dirname, '..', oldFilePath);
      
      if (!fs.existsSync(absoluteOldPath)) {
        console.warn(`[${new Date().toISOString()}] File not found for status change: ${absoluteOldPath}`);
        return oldFilePath; // Return original path if file doesn't exist
      }

      const year = new Date().getFullYear();
      const newFolderPath = this.ensureFolderStructure(jobId, jobTitle, year, newStatus);
      
      // Get file extension and preserve original filename (or generate new one)
      const fileExtension = path.extname(absoluteOldPath);
      const originalFileName = path.basename(absoluteOldPath);
      
      // Try to preserve original filename, but generate new one if needed
      let fileName = originalFileName;
      if (!originalFileName.match(/^\d{4}-\d{2}-\d{2}_/)) {
        // If filename doesn't follow our format, generate new one
        fileName = this.generateFileName(candidateName, email, fileExtension);
      }
      
      const newFilePath = path.join(newFolderPath, fileName);
      
      // Handle duplicates
      let finalPath = newFilePath;
      let counter = 1;
      while (fs.existsSync(finalPath) && finalPath !== absoluteOldPath) {
        const nameWithoutExt = path.basename(newFilePath, fileExtension);
        finalPath = path.join(newFolderPath, `${nameWithoutExt}_${counter}${fileExtension}`);
        counter++;
      }
      
      // Move file
      if (finalPath !== absoluteOldPath) {
        fs.renameSync(absoluteOldPath, finalPath);
        
        // Return relative path
        const relativePath = path.relative(path.join(__dirname, '..', 'uploads'), finalPath);
        return relativePath.replace(/\\/g, '/');
      }
      
      return oldFilePath; // File already in correct location
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FileManager Status Change Error:`, error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  deleteFile(filePath) {
    try {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(__dirname, '..', 'uploads', filePath);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FileManager Delete Error:`, error);
      return false;
    }
  }

  /**
   * Get organized file path for new upload
   * This is used during initial file upload
   */
  getOrganizedPath(jobId, jobTitle, candidateName, email, status = 'pending', originalFileName) {
    const year = new Date().getFullYear();
    const folderPath = this.ensureFolderStructure(jobId, jobTitle, year, status);
    
    const fileExtension = path.extname(originalFileName);
    const fileName = this.generateFileName(candidateName, email, fileExtension);
    
    const fullPath = path.join(folderPath, fileName);
    
    // Handle duplicates
    let finalPath = fullPath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const nameWithoutExt = path.basename(fullPath, fileExtension);
      finalPath = path.join(folderPath, `${nameWithoutExt}_${counter}${fileExtension}`);
      counter++;
    }
    
    // Return relative path from uploads directory
    const relativePath = path.relative(path.join(__dirname, '..', 'uploads'), finalPath);
    return relativePath.replace(/\\/g, '/');
  }
}

export default new FileManager();
