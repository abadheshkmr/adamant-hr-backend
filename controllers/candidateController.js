import CandidateModel from '../models/candidateModel.js';
import ApplicationModel from '../models/applicationModel.js';
import VacancyModel from '../models/vacancyModel.js';
import { readFile } from 'fs/promises';
import fs from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Link Firebase user to candidate by email (after registration).
 * POST /api/candidate/link - requires Firebase token in Authorization header.
 *
 * If no candidate exists with this email, creates one (register-first flow).
 * When they apply later, their profile will be updated with real details.
 */
export const linkAccount = async (req, res) => {
  try {
    const { uid, email, name } = req.firebaseUser || {};
    if (!uid || !email) {
      console.warn('[linkAccount] Invalid token payload: missing uid or email', { hasUid: !!uid, hasEmail: !!email });
      return res.status(400).json({ success: false, message: 'Invalid token payload' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let candidate = await CandidateModel.findOne({ email: normalizedEmail });

    if (!candidate) {
      // Parse name from Google (e.g. "John Doe" -> firstName: John, lastName: Doe)
      let firstName = 'User';
      let lastName = 'Candidate';
      if (name && typeof name === 'string') {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        } else if (parts.length === 1 && parts[0].length >= 2) {
          firstName = parts[0];
        }
      } else {
        const namePart = (normalizedEmail.split('@')[0] || 'User').replace(/[^a-z0-9]/gi, '') || 'User';
        firstName = namePart.length >= 2 ? namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase() : 'User';
      }
      candidate = new CandidateModel({
        firstName,
        lastName,
        email: normalizedEmail,
        mobileNo: '+0000000000', // Placeholder - user must complete profile
        firebaseUid: uid,
      });
      await candidate.save();
      console.log(`[linkAccount] Created new candidate for ${normalizedEmail} (register-first)`);
      return res.json({ success: true, message: 'Account linked successfully', data: { candidateId: candidate._id } });
    }

    // Same UID: already linked, no-op success
    if (candidate.firebaseUid === uid) {
      console.log('[linkAccount] Already linked:', { email: normalizedEmail, candidateId: candidate._id.toString() });
      return res.json({ success: true, message: 'Account linked successfully', data: { candidateId: candidate._id } });
    }

    // Different UID: email was linked to another Firebase user (e.g. old email/password account).
    // Re-link to current user so Google sign-in can take over; one candidate per email.
    if (candidate.firebaseUid && candidate.firebaseUid !== uid) {
      console.log('[linkAccount] Re-linking email to new Firebase user:', {
        email: normalizedEmail,
        previousUid: candidate.firebaseUid,
        newUid: uid,
        candidateId: candidate._id.toString(),
      });
    }

    candidate.firebaseUid = uid;
    await candidate.save();
    console.log('[linkAccount] Link updated:', { email: normalizedEmail, candidateId: candidate._id.toString() });
    return res.json({ success: true, message: 'Account linked successfully', data: { candidateId: candidate._id } });
  } catch (err) {
    console.error('[linkAccount] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get candidate profile + applications.
 * GET /api/candidate/me
 */
export const getMe = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) {
      console.warn('[getMe] No candidate on request', { uid: req.firebaseUser?.uid });
      return res.status(403).json({ success: false, message: 'Not authenticated' });
    }

    const applications = await ApplicationModel.find({ candidateId: candidate._id })
      .sort({ appliedAt: -1 })
      .lean();

    const jobIds = [...new Set(applications.map((a) => a.jobId))];
    const vacancies = await VacancyModel.find({ jobId: { $in: jobIds } })
      .select('jobId jobTitle industry location employmentType')
      .populate('industry', 'name')
      .lean();

    const jobMap = {};
    vacancies.forEach((v) => { jobMap[v.jobId] = v; });

    const applicationsWithJob = applications.map((app) => ({
      ...app,
      job: jobMap[app.jobId] || null,
    }));

    const profile = {
      _id: candidate._id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      mobileNo: candidate.mobileNo,
      address: candidate.address,
      city: candidate.city,
      state: candidate.state,
      tenthPercentage: candidate.tenthPercentage,
      twelfthPercentage: candidate.twelfthPercentage,
      degree: candidate.degree,
      degreeCgpa: candidate.degreeCgpa,
      resume: candidate.resume,
      documents: candidate.documents || [],
    };

    return res.json({
      success: true,
      data: { profile, applications: applicationsWithJob },
    });
  } catch (err) {
    console.error('[getMe] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update candidate profile.
 * PUT /api/candidate/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) {
      console.warn('[updateProfile] No candidate on request', { uid: req.firebaseUser?.uid });
      return res.status(403).json({ success: false, message: 'Not authenticated' });
    }

    const doc = await CandidateModel.findById(candidate._id);
    if (!doc) {
      console.warn('[updateProfile] 404 Candidate not found:', { candidateId: candidate._id?.toString() });
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const allowed = ['firstName', 'lastName', 'mobileNo', 'address', 'city', 'state', 'tenthPercentage', 'twelfthPercentage', 'degree', 'degreeCgpa'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (['tenthPercentage', 'twelfthPercentage', 'degreeCgpa'].includes(key)) {
          doc[key] = req.body[key] === '' ? undefined : parseFloat(req.body[key]);
        } else {
          doc[key] = req.body[key];
        }
      }
    }

    await doc.save();

    return res.json({ success: true, message: 'Profile updated', data: doc });
  } catch (err) {
    console.error('[updateProfile] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get primary resume metadata (Firebase Storage path).
 * GET /api/candidate/resume
 */
export const getResume = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const doc = await CandidateModel.findById(candidate._id).select('resume').lean();
    if (!doc?.resume?.storagePath) {
      return res.status(404).json({ success: false, message: 'No resume uploaded yet' });
    }

    return res.json({
      success: true,
      data: {
        storagePath: doc.resume.storagePath,
        fileName: doc.resume.fileName,
        uploadedAt: doc.resume.uploadedAt,
      },
    });
  } catch (err) {
    console.error('[getResume]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update primary resume metadata (after frontend uploads to Firebase Storage).
 * POST /api/candidate/resume - body: { storagePath, fileName }
 */
export const updateResume = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const { storagePath, fileName } = req.body;
    if (!storagePath || !fileName) {
      return res.status(400).json({ success: false, message: 'storagePath and fileName required' });
    }

    await CandidateModel.findByIdAndUpdate(candidate._id, {
      resume: {
        storagePath: String(storagePath).trim(),
        fileName: String(fileName).trim(),
        uploadedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'Resume updated' });
  } catch (err) {
    console.error('[updateResume]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * List documents (PAN, AADHAR, marksheets).
 * GET /api/candidate/documents
 */
export const getDocuments = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const doc = await CandidateModel.findById(candidate._id).select('documents').lean();
    const documents = (doc?.documents || []).map((d) => ({
      _id: d._id,
      docType: d.docType,
      fileName: d.fileName,
      storagePath: d.storagePath,
      uploadedAt: d.uploadedAt,
    }));

    return res.json({ success: true, data: documents });
  } catch (err) {
    console.error('[getDocuments]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Add document (after frontend uploads to Firebase Storage).
 * POST /api/candidate/documents - body: { docType, storagePath, fileName }
 */
export const addDocument = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const { docType, storagePath, fileName } = req.body;
    if (!docType || !storagePath || !fileName) {
      return res.status(400).json({ success: false, message: 'docType, storagePath and fileName required' });
    }

    const allowedTypes = ['PAN', 'AADHAR', 'marksheet', 'other'];
    if (!allowedTypes.includes(String(docType).toUpperCase())) {
      return res.status(400).json({ success: false, message: 'docType must be PAN, AADHAR, marksheet, or other' });
    }

    const doc = await CandidateModel.findById(candidate._id);
    if (!doc) return res.status(404).json({ success: false, message: 'Candidate not found' });

    doc.documents = doc.documents || [];
    doc.documents.push({
      docType: String(docType).toUpperCase(),
      storagePath: String(storagePath).trim(),
      fileName: String(fileName).trim(),
      uploadedAt: new Date(),
    });
    await doc.save();

    const added = doc.documents[doc.documents.length - 1];
    return res.json({ success: true, data: { _id: added._id, docType: added.docType, fileName: added.fileName, uploadedAt: added.uploadedAt } });
  } catch (err) {
    console.error('[addDocument]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Delete document.
 * DELETE /api/candidate/documents/:id
 */
export const deleteDocument = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const docId = req.params.id;
    const doc = await CandidateModel.findById(candidate._id);
    if (!doc) return res.status(404).json({ success: false, message: 'Candidate not found' });

    doc.documents = doc.documents || [];
    const idx = doc.documents.findIndex((d) => String(d._id) === docId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    doc.documents.splice(idx, 1);
    await doc.save();

    return res.json({ success: true, message: 'Document removed' });
  } catch (err) {
    console.error('[deleteDocument]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Download resume for a specific application (stored in backend uploads).
 * GET /api/candidate/application/:applicationId/resume
 */
export const getApplicationResume = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const applicationId = req.params.applicationId;
    const application = await ApplicationModel.findOne({
      _id: applicationId,
      candidateId: candidate._id,
    }).lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const resumeUrl = application.resume?.url;
    if (!resumeUrl) {
      return res.status(404).json({ success: false, message: 'No resume for this application' });
    }

    const uploadsDir = join(__dirname, '..', 'uploads', 'resumes');
    const filename = resumeUrl.replace(/^uploads\/resumes\//, '').split('/').pop() || resumeUrl.split('/').pop();
    const filePath = join(uploadsDir, filename);

    try {
      const buffer = await readFile(filePath);
      const ext = filename.split('.').pop() || 'pdf';
      const contentType = ext === 'pdf' ? 'application/pdf' : 'application/msword';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (fileErr) {
      return res.status(404).json({ success: false, message: 'Resume file not found' });
    }
  } catch (err) {
    console.error('[getApplicationResume]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update resume for an existing application (re-upload).
 * POST /api/candidate/application/:applicationId/resume - multipart file
 */
export const updateApplicationResume = async (req, res) => {
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    if (!req.file || !req.file.filename) {
      return res.status(400).json({ success: false, message: 'Resume file is required' });
    }

    const applicationId = req.params.applicationId;
    const application = await ApplicationModel.findOne({
      _id: applicationId,
      candidateId: candidate._id,
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const oldUrl = application.resume?.url;
    const newUrl = `uploads/resumes/${req.file.filename}`;

    if (oldUrl) {
      const uploadsDir = join(__dirname, '..', 'uploads', 'resumes');
      const oldFilename = oldUrl.replace(/^uploads\/resumes\//, '').split('/').pop();
      if (oldFilename) {
        const oldPath = join(uploadsDir, oldFilename);
        fs.unlink(oldPath, (err) => {
          if (err) console.error('[updateApplicationResume] Could not delete old file:', err.message);
        });
      }
    }

    application.resume = { url: newUrl };
    await application.save();

    console.log('[updateApplicationResume] Updated resume for application:', { applicationId, candidateId: candidate._id.toString() });
    return res.json({ success: true, message: 'Resume updated successfully' });
  } catch (err) {
    console.error('[updateApplicationResume] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
