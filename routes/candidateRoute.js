import express from 'express';
import multer from 'multer';
import {
  linkAccount,
  getRegistrationStatus,
  register,
  verifyEmailAndMerge,
  verifyPhoneAndMerge,
  getMe,
  updateProfile,
  getResume,
  getResumeDownloadUrl,
  updateResume,
  getDocuments,
  addDocument,
  deleteDocument,
  verifyDocument,
  getDocumentDownloadUrl,
  getApplicationResume,
  updateApplicationResume,
} from '../controllers/candidateController.js';
import { sendEmailOtp, verifyEmailOtp, sendMergePhoneOtp } from '../controllers/emailOtpController.js';
import { verifyFirebaseToken, verifyFirebaseCandidate } from '../middleware/verifyFirebaseUser.js';

const candidateRouter = express.Router();

// Email OTP (no auth required)
candidateRouter.post('/send-email-otp', sendEmailOtp);
candidateRouter.post('/verify-email-otp', verifyEmailOtp);

// Merge flow: verify OTP and link existing profile to current uid (auth required)
candidateRouter.post('/verify-email-and-merge', verifyFirebaseToken, verifyEmailAndMerge);
candidateRouter.post('/verify-phone-and-merge', verifyFirebaseToken, verifyPhoneAndMerge);
candidateRouter.post('/send-merge-phone-otp', sendMergePhoneOtp);

const resumeStorage = multer.diskStorage({
  destination: 'uploads/resumes',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const uploadResume = multer({ storage: resumeStorage });

// Link Firebase user to existing candidate (no creation) - requires Firebase token
candidateRouter.post('/link', verifyFirebaseToken, linkAccount);

// Registration: check status and complete profile (firstName, lastName, email, phone)
candidateRouter.get('/registration-status', verifyFirebaseToken, getRegistrationStatus);
candidateRouter.post('/register', verifyFirebaseToken, register);

// All routes below require linked candidate (complete profile)
candidateRouter.get('/me', verifyFirebaseCandidate, getMe);
candidateRouter.put('/profile', verifyFirebaseCandidate, updateProfile);
candidateRouter.get('/resume', verifyFirebaseCandidate, getResume);
candidateRouter.get('/resume-download-url', verifyFirebaseCandidate, getResumeDownloadUrl);
candidateRouter.post('/resume', verifyFirebaseCandidate, updateResume);
candidateRouter.get('/documents', verifyFirebaseCandidate, getDocuments);
candidateRouter.post('/documents', verifyFirebaseCandidate, addDocument);
candidateRouter.get('/documents/:id/download-url', verifyFirebaseCandidate, getDocumentDownloadUrl);
candidateRouter.post('/documents/:id/verify', verifyFirebaseCandidate, verifyDocument);
candidateRouter.delete('/documents/:id', verifyFirebaseCandidate, deleteDocument);
candidateRouter.get('/application/:applicationId/resume', verifyFirebaseCandidate, getApplicationResume);
candidateRouter.post('/application/:applicationId/resume', verifyFirebaseCandidate, uploadResume.single('resume'), updateApplicationResume);

export default candidateRouter;
