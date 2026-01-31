import CandidateModel from '../models/candidateModel.js';
import ApplicationModel from '../models/applicationModel.js';
import VacancyModel from '../models/vacancyModel.js';
import { verifyAndConsumeEmailOtp, verifyAndConsumePhoneOtp } from '../controllers/emailOtpController.js';
import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';
import { readFile } from 'fs/promises';
import fs from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Normalize phone to digits only (no + or spaces). Stored in DB without +; add + only for display. */
function normalizePhoneToDigits(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

const PHONE_DIGITS_REGEX = /^[0-9]{10,15}$/;

function getPhoneRegion() {
  const v = (process.env.PHONE_REGION || 'US').toUpperCase();
  return v === 'IN' ? 'IN' : 'US';
}

function validatePhoneByRegion(digits) {
  const region = getPhoneRegion();
  if (region === 'IN') {
    return /^91[0-9]{10}$/.test(digits);
  }
  if (region === 'US') {
    return /^1[0-9]{10}$/.test(digits);
  }
  return PHONE_DIGITS_REGEX.test(digits);
}

function getPhoneValidationMessage() {
  const region = getPhoneRegion();
  if (region === 'IN') return 'Valid Indian number required (12 digits, e.g. 919876543210)';
  if (region === 'US') return 'Valid US number required (11 digits, e.g. 14692685229)';
  return 'Valid phone number is required (10–15 digits)';
}

/**
 * Check if the current Firebase user has a complete candidate profile.
 * GET /api/candidate/registration-status - requires Firebase token.
 * Used to decide whether to show registration form or full app.
 */
export const getRegistrationStatus = async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) {
      return res.json({ success: true, data: { complete: false } });
    }
    const candidate = await CandidateModel.findOne({ firebaseUid: uid }).lean();
    const complete = Boolean(
      candidate &&
      candidate.firstName &&
      candidate.lastName &&
      candidate.email &&
      candidate.mobileNo &&
      /^\S+@\S+\.\S+$/.test(String(candidate.email)) &&
      (PHONE_DIGITS_REGEX.test(String(candidate.mobileNo)) || /^\+?[0-9]{10,15}$/.test(String(candidate.mobileNo)))
    );
    return res.json({ success: true, data: { complete } });
  } catch (err) {
    console.error('[getRegistrationStatus] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Register / complete profile: create or update candidate with firstName, lastName, email, phone.
 * POST /api/candidate/register - requires Firebase token.
 * Body: { firstName, lastName, email, phone } (all required).
 *
 * Flow: 1) Find candidate by current uid. If found → update and return.
 *       2) Find by email. If found and linked to another uid → 409 (email conflict).
 *       3) Find by phone. If found and linked to another uid → 409 (phone conflict).
 *       4) If found by email (no conflict) → link uid to that candidate (re-link).
 *       5) If found by phone (no conflict) → link uid to that candidate (re-link).
 *       6) Else → create new candidate.
 * RCA: 409 phone = same phone was used to register before with a different Firebase identity (e.g. phone vs email).
 */
export const register = async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { firstName, lastName, email, phone } = req.body || {};
    const f = (String(firstName || '').trim());
    const l = (String(lastName || '').trim());
    const e = (String(email || '').trim().toLowerCase());
    const p = normalizePhoneToDigits(String(phone || ''));

    console.log('[register] Start', { uid, email: e, phoneDigits: p, hasEmail: !!e, hasPhone: !!p });

    if (!f || f.length < 2) {
      return res.status(400).json({ success: false, message: 'Valid first name is required (min 2 characters)' });
    }
    if (!l || l.length < 2) {
      return res.status(400).json({ success: false, message: 'Valid last name is required (min 2 characters)' });
    }
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }
    if (!p || !validatePhoneByRegion(p)) {
      return res.status(400).json({ success: false, message: getPhoneValidationMessage() });
    }

    let candidate = await CandidateModel.findOne({ firebaseUid: uid });
    if (candidate) {
      candidate.firstName = f;
      candidate.lastName = l;
      candidate.email = e;
      candidate.mobileNo = p;
      await candidate.save();
      console.log('[register] Updated existing candidate for this uid', { candidateId: candidate._id.toString(), uid });
      return res.json({ success: true, message: 'Profile updated', data: { candidateId: candidate._id } });
    }

    // Check phone first: if user added a phone that's already on another profile (e.g. after social login), show phone conflict and merge flow
    const byPhone = await CandidateModel.findOne({
      $or: [{ mobileNo: p }, { mobileNo: `+${p}` }],
    });
    if (byPhone && byPhone.firebaseUid && byPhone.firebaseUid !== uid) {
      console.warn('[register] 409 Phone already registered by another account', {
        phoneDigits: p,
        currentUid: uid,
        existingUid: byPhone.firebaseUid,
        existingCandidateId: byPhone._id?.toString(),
      });
      return res.status(409).json({
        success: false,
        message: 'This phone number is already registered in another profile. Do you want to merge? If yes, verify using the OTP we send to your phone.',
        conflictType: 'phone',
      });
    }

    const byEmail = await CandidateModel.findOne({ email: e });
    if (byEmail && byEmail.firebaseUid && byEmail.firebaseUid !== uid) {
      // User signed in with this email (e.g. Google) — they already proved ownership. Link the existing profile to this account; no email OTP.
      const currentUserEmail = (req.firebaseUser?.email || '').trim().toLowerCase();
      if (currentUserEmail === e) {
        byEmail.firebaseUid = uid;
        byEmail.firstName = f;
        byEmail.lastName = l;
        byEmail.mobileNo = p;
        await byEmail.save();
        console.log('[register] Linked existing candidate by email (same-email sign-in, e.g. Google)', {
          candidateId: byEmail._id.toString(),
          uid,
          email: e,
        });
        return res.json({ success: true, message: 'Profile linked successfully', data: { candidateId: byEmail._id } });
      }
      console.warn('[register] 409 Email already registered by another account', {
        email: e,
        currentUid: uid,
        existingUid: byEmail.firebaseUid,
        existingCandidateId: byEmail._id?.toString(),
      });
      return res.status(409).json({
        success: false,
        message: 'This email is already linked to another account. Do you want to merge? If yes, verify using the OTP we send to your email.',
        conflictType: 'email',
      });
    }

    if (byEmail) {
      byEmail.firebaseUid = uid;
      byEmail.firstName = f;
      byEmail.lastName = l;
      byEmail.mobileNo = p;
      await byEmail.save();
      console.log('[register] Linked existing candidate by email', {
        candidateId: byEmail._id.toString(),
        uid,
        email: e,
      });
      return res.json({ success: true, message: 'Account linked successfully', data: { candidateId: byEmail._id } });
    }
    if (byPhone) {
      byPhone.firebaseUid = uid;
      byPhone.firstName = f;
      byPhone.lastName = l;
      byPhone.email = e;
      await byPhone.save();
      console.log('[register] Linked existing candidate by phone', {
        candidateId: byPhone._id.toString(),
        uid,
        phoneDigits: p,
      });
      return res.json({ success: true, message: 'Account linked successfully', data: { candidateId: byPhone._id } });
    }

    candidate = new CandidateModel({
      firstName: f,
      lastName: l,
      email: e,
      mobileNo: p,
      firebaseUid: uid,
    });
    await candidate.save();
    console.log('[register] Created new candidate', {
      candidateId: candidate._id.toString(),
      uid,
      email: e,
      phoneDigits: p,
    });
    return res.status(201).json({ success: true, message: 'Profile created', data: { candidateId: candidate._id } });
  } catch (err) {
    if (err.name === 'MongoServerError' && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This email or phone is already in use.' });
    }
    console.error('[register] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Verify email OTP and link existing candidate (by email) to current Firebase uid (merge).
 * POST /api/candidate/verify-email-and-merge - requires Firebase token. Body: { email, code }.
 * Call send-email-otp first, then this with the code.
 */
export const verifyEmailAndMerge = async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { email, code } = req.body || {};
    const result = verifyAndConsumeEmailOtp(email, code);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }
    const normalized = (String(email || '').trim().toLowerCase());
    const candidate = await CandidateModel.findOne({ email: normalized });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'No profile found for this email.' });
    }
    candidate.firebaseUid = uid;
    await candidate.save();
    console.log('[verifyEmailAndMerge] Linked candidate to current uid', {
      candidateId: candidate._id.toString(),
      uid,
      email: normalized,
    });
    return res.json({ success: true, message: 'Account linked. You can continue.', data: { candidateId: candidate._id } });
  } catch (err) {
    console.error('[verifyEmailAndMerge] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Verify phone OTP and link existing candidate (by phone) to current Firebase uid (merge).
 * POST /api/candidate/verify-phone-and-merge - requires Firebase token. Body: { phone, code }.
 * Call send-merge-phone-otp first (requires SMS configured), then this with the code.
 */
export const verifyPhoneAndMerge = async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { phone, code } = req.body || {};
    const p = normalizePhoneToDigits(String(phone || ''));
    if (!p || !PHONE_DIGITS_REGEX.test(p)) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }
    const result = verifyAndConsumePhoneOtp(p, code);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }
    const candidate = await CandidateModel.findOne({ $or: [{ mobileNo: p }, { mobileNo: `+${p}` }] });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'No profile found for this phone.' });
    }
    candidate.firebaseUid = uid;
    await candidate.save();
    console.log('[verifyPhoneAndMerge] Linked candidate to current uid', {
      candidateId: candidate._id.toString(),
      uid,
      phoneDigits: p,
    });
    return res.json({ success: true, message: 'Account linked. You can continue.', data: { candidateId: candidate._id } });
  } catch (err) {
    console.error('[verifyPhoneAndMerge] Error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Link Firebase user to existing candidate by email or phone (no creation).
 * POST /api/candidate/link - requires Firebase token.
 * If a candidate already exists for this uid (from register), returns success.
 * If token has email/phone and a candidate exists with that email/phone, links uid to that candidate.
 * Otherwise returns success with registered: false so frontend shows registration.
 */
export const linkAccount = async (req, res) => {
  try {
    const { uid, email, phone_number } = req.firebaseUser || {};
    if (!uid) {
      return res.status(400).json({ success: false, message: 'Invalid token payload' });
    }

    let candidate = await CandidateModel.findOne({ firebaseUid: uid });
    if (candidate) {
      return res.json({ success: true, message: 'Account linked', data: { candidateId: candidate._id, registered: true } });
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
    if (normalizedEmail && /^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      candidate = await CandidateModel.findOne({ email: normalizedEmail });
      if (candidate) {
        candidate.firebaseUid = uid;
        await candidate.save();
        console.log('[linkAccount] Linked by email:', { email: normalizedEmail, candidateId: candidate._id.toString() });
        return res.json({ success: true, message: 'Account linked', data: { candidateId: candidate._id, registered: true } });
      }
    }

    const phoneDigits = normalizePhoneToDigits(phone_number || '');
    if (phoneDigits && PHONE_DIGITS_REGEX.test(phoneDigits)) {
      candidate = await CandidateModel.findOne({
        $or: [{ mobileNo: phoneDigits }, { mobileNo: `+${phoneDigits}` }],
      });
      if (candidate) {
        candidate.firebaseUid = uid;
        await candidate.save();
        console.log('[linkAccount] Linked by phone:', { candidateId: candidate._id.toString() });
        return res.json({ success: true, message: 'Account linked', data: { candidateId: candidate._id, registered: true } });
      }
    }

    return res.json({ success: true, message: 'Not registered yet', data: { registered: false } });
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
        } else if (key === 'mobileNo') {
          const digits = normalizePhoneToDigits(String(req.body[key]));
          if (!digits || !validatePhoneByRegion(digits)) {
            return res.status(400).json({ success: false, message: getPhoneValidationMessage() });
          }
          doc[key] = digits;
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
    console.error('[getResume]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get a signed download URL for the candidate's primary resume (Firebase Storage).
 * GET /api/candidate/resume-download-url
 * Backend uses Admin SDK so errors (e.g. file not found, bucket permission) are logged here.
 */
export const getResumeDownloadUrl = async (req, res) => {
  let storagePathForLog = null;
  try {
    const candidate = req.candidate;
    if (!candidate) return res.status(403).json({ success: false, message: 'Not authenticated' });

    const doc = await CandidateModel.findById(candidate._id).select('resume').lean();
    if (!doc?.resume?.storagePath) {
      return res.status(404).json({ success: false, message: 'No resume uploaded yet' });
    }
    storagePathForLog = doc.resume.storagePath;

    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      console.error('[getResumeDownloadUrl] Firebase not initialized');
      return res.status(503).json({ success: false, message: 'Service unavailable' });
    }

    const admin = getFirebaseAdmin();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(doc.resume.storagePath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return res.json({ success: true, data: { url } });
  } catch (err) {
    console.error('[getResumeDownloadUrl]', err?.code || err?.name, err?.message, 'path=', storagePathForLog, err?.stack);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to get resume download URL' });
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

