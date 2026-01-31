import sgMail from '@sendgrid/mail';
import vacancyModel from '../models/vacancyModel.js';
import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';
import mongoose from 'mongoose';

function isSendGridConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_MAIL_FROM);
}

/**
 * POST /api/vacancy/contact-recruiter
 * Body: { jobId?: number, vacancyId?: string, message: string, candidateName?: string, candidateEmail: string }
 * Sends the candidate's message to the job's recruiter via SendGrid.
 */
export async function contactRecruiter(req, res) {
  try {
    const { jobId, vacancyId, message, candidateName, candidateEmail } = req.body || {};

    const messageText = (message || '').trim();
    if (!messageText || messageText.length > 5000) {
      return res.status(400).json({ success: false, message: 'Message is required and must be at most 5000 characters' });
    }

    const email = (candidateEmail || '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid candidate email is required so the recruiter can reply' });
    }

    let vacancy;
    if (vacancyId && mongoose.Types.ObjectId.isValid(vacancyId) && String(vacancyId).length === 24) {
      vacancy = await vacancyModel.findById(vacancyId).select('jobTitle recruiterUid').lean();
    } else if (jobId != null && !Number.isNaN(Number(jobId))) {
      vacancy = await vacancyModel.findOne({ jobId: Number(jobId) }).select('jobTitle recruiterUid').lean();
    }
    if (!vacancy) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    if (!vacancy.recruiterUid) {
      return res.status(400).json({ success: false, message: 'This job has no contact person assigned' });
    }

    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      return res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
    }
    const admin = getFirebaseAdmin();
    let recruiterEmail;
    try {
      const user = await admin.auth().getUser(vacancy.recruiterUid);
      recruiterEmail = (user.email || '').trim();
    } catch {
      return res.status(400).json({ success: false, message: 'Recruiter contact not available' });
    }
    if (!recruiterEmail) {
      return res.status(400).json({ success: false, message: 'Recruiter has no email on file' });
    }

    if (!isSendGridConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Please try again later.',
      });
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const from = process.env.SENDGRID_MAIL_FROM;
    const jobTitle = vacancy.jobTitle || 'Job';
    const nameLine = candidateName ? `From: ${(candidateName || '').trim()}` : '';
    const replyNote = `You can reply directly to this email to reach the candidate.`;
    const text = [
      `A candidate sent you a message about the position: ${jobTitle}`,
      '',
      nameLine,
      `Email: ${email}`,
      '',
      'Message:',
      '---',
      messageText,
      '---',
      '',
      replyNote,
    ].filter(Boolean).join('\n');

    const html = [
      `<p>A candidate sent you a message about the position: <strong>${escapeHtml(jobTitle)}</strong></p>`,
      candidateName ? `<p><strong>From:</strong> ${escapeHtml((candidateName || '').trim())}</p>` : '',
      `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
      '<p><strong>Message:</strong></p>',
      `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(messageText)}</pre>`,
      `<p style="color:#666;font-size:14px;">${replyNote}</p>`,
    ].filter(Boolean).join('\n');

    await sgMail.send({
      to: recruiterEmail,
      from,
      replyTo: email,
      subject: `Candidate message re: ${jobTitle}`,
      text,
      html,
    });

    return res.json({ success: true, message: 'Message sent. The recruiter will get back to you at your email.' });
  } catch (err) {
    console.error('[contactRecruiter]', err?.message, err?.response?.body);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to send message' });
  }
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
