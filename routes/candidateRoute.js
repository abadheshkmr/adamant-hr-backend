import express from 'express';
import multer from 'multer';
import {
  linkAccount,
  getMe,
  updateProfile,
  getResume,
  updateResume,
  getDocuments,
  addDocument,
  deleteDocument,
  getApplicationResume,
  updateApplicationResume,
} from '../controllers/candidateController.js';
import { sendEmailOtp, verifyEmailOtp } from '../controllers/emailOtpController.js';
import { verifyFirebaseToken, verifyFirebaseCandidate } from '../middleware/verifyFirebaseUser.js';

const candidateRouter = express.Router();

// Email OTP (no auth required)
candidateRouter.post('/send-email-otp', sendEmailOtp);
candidateRouter.post('/verify-email-otp', verifyEmailOtp);

const resumeStorage = multer.diskStorage({
  destination: 'uploads/resumes',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const uploadResume = multer({ storage: resumeStorage });

// Link Firebase user to candidate (after registration) - requires Firebase token
candidateRouter.post('/link', verifyFirebaseToken, linkAccount);

// All routes below require linked candidate
candidateRouter.get('/me', verifyFirebaseCandidate, getMe);
candidateRouter.put('/profile', verifyFirebaseCandidate, updateProfile);
candidateRouter.get('/resume', verifyFirebaseCandidate, getResume);
candidateRouter.post('/resume', verifyFirebaseCandidate, updateResume);
candidateRouter.get('/documents', verifyFirebaseCandidate, getDocuments);
candidateRouter.post('/documents', verifyFirebaseCandidate, addDocument);
candidateRouter.delete('/documents/:id', verifyFirebaseCandidate, deleteDocument);
candidateRouter.get('/application/:applicationId/resume', verifyFirebaseCandidate, getApplicationResume);
candidateRouter.post('/application/:applicationId/resume', verifyFirebaseCandidate, uploadResume.single('resume'), updateApplicationResume);

export default candidateRouter;
