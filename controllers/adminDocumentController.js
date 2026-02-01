import CandidateModel from '../models/candidateModel.js';
import { getFirebaseAdmin, initFirebaseAdmin } from '../utils/firebaseAdmin.js';
import sgMail from '@sendgrid/mail';

function getPrimarySuperAdminEmail() {
  const primary = (process.env.PRIMARY_SUPERADMIN_EMAIL || '').trim();
  if (primary && /^\S+@\S+\.\S+$/.test(primary)) return primary;
  const list = (process.env.INTERNAL_SUPERADMINS || '').split(',').map((e) => e.trim()).filter((e) => /^\S+@\S+\.\S+$/.test(e));
  return list[0] || null;
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Send notification to primary super admin that an admin verified/rejected a candidate document (fire-and-forget).
 */
function sendVerificationNotificationEmail({ toEmail, adminEmail, candidateName, candidateEmail, documentLabel, status, notes }) {
  if (!toEmail || !process.env.SENDGRID_API_KEY || !process.env.SENDGRID_MAIL_FROM) return;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const from = process.env.SENDGRID_MAIL_FROM;
  const action = status === 'verified' ? 'verified' : 'rejected';
  const subject = `Document ${action}: ${documentLabel || 'Document'} – ${candidateName || candidateEmail || 'Candidate'}`;
  const text = [
    `An admin has ${action} a candidate document.`,
    '',
    `Admin: ${adminEmail}`,
    `Candidate: ${candidateName || '—'} (${candidateEmail || '—'})`,
    `Document: ${documentLabel || '—'}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n');
  const html = [
    `<p>An admin has <strong>${escapeHtml(action)}</strong> a candidate document.</p>`,
    '<ul>',
    `<li><strong>Admin:</strong> ${escapeHtml(adminEmail)}</li>`,
    `<li><strong>Candidate:</strong> ${escapeHtml(candidateName || '—')} (${escapeHtml(candidateEmail || '—')})</li>`,
    `<li><strong>Document:</strong> ${escapeHtml(documentLabel || '—')}</li>`,
    notes ? `<li><strong>Notes:</strong> ${escapeHtml(notes)}</li>` : '',
    '</ul>',
  ].filter(Boolean).join('\n');
  sgMail.send({ to: toEmail, from, subject, text, html }).catch((err) => console.error('[sendVerificationNotificationEmail]', err?.message, err?.response?.body));
}

/**
 * GET /api/admin/documents/pending-count
 * Returns count of candidate documents with verificationStatus === 'pending'.
 */
export async function getPendingCount(req, res) {
  try {
    const count = await CandidateModel.aggregate([
      { $unwind: '$documents' },
      { $match: { 'documents.verificationStatus': 'pending' } },
      { $count: 'count' },
    ]);
    const total = count[0]?.count ?? 0;
    return res.json({ success: true, data: { count: total } });
  } catch (err) {
    console.error('[getPendingCount]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * GET /api/admin/documents/pending
 * List all candidate documents with verificationStatus === 'pending'.
 * Returns array of { candidateId, candidateName, candidateEmail, documentId, label, documentSide, category, fileName, uploadedAt }.
 */
export async function listPending(req, res) {
  try {
    const candidates = await CandidateModel.find(
      { 'documents.verificationStatus': 'pending' },
      { firstName: 1, lastName: 1, email: 1, documents: 1 }
    ).lean();

    const items = [];
    for (const c of candidates) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '—';
      for (const d of c.documents || []) {
        if (d.verificationStatus !== 'pending') continue;
        items.push({
          candidateId: c._id.toString(),
          candidateName: name,
          candidateEmail: c.email || '',
          documentId: d._id.toString(),
          label: d.label || d.category || '—',
          documentSide: d.documentSide || null,
          idNumber: d.idNumber || null,
          category: d.category || '—',
          fileName: d.fileName || '—',
          uploadedAt: d.uploadedAt,
        });
      }
    }
    // Sort by uploadedAt descending
    items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('[listPending]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * GET /api/admin/candidates/:candidateId/documents/:documentId/download-url
 * Returns signed download URL for a candidate document (admin view).
 */
export async function getDocumentDownloadUrl(req, res) {
  let storagePathForLog = null;
  try {
    const { candidateId, documentId } = req.params;
    const candidate = await CandidateModel.findById(candidateId).select('documents').lean();
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const document = (candidate.documents || []).find((d) => String(d._id) === documentId);
    if (!document?.storagePath) return res.status(404).json({ success: false, message: 'Document not found' });
    storagePathForLog = document.storagePath;

    const init = initFirebaseAdmin();
    if (!init.firebaseInitialized) {
      console.error('[admin getDocumentDownloadUrl] Firebase not initialized');
      return res.status(503).json({ success: false, message: 'Service unavailable' });
    }

    const admin = getFirebaseAdmin();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(document.storagePath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });

    return res.json({ success: true, data: { url } });
  } catch (err) {
    console.error('[admin getDocumentDownloadUrl]', err?.code || err?.message, 'path=', storagePathForLog, err?.stack);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to get download URL' });
  }
}

/**
 * PATCH /api/admin/candidates/:candidateId/documents/:documentId/verification
 * Body: { status: 'verified' | 'failed', notes?: string }
 * Sets verificationStatus, verifiedAt, verifiedBy (admin email), notes.
 */
export async function setVerification(req, res) {
  try {
    const { candidateId, documentId } = req.params;
    const { status, notes } = req.body;
    const adminEmail = req.admin?.email || req.admin?.uid || 'admin';

    if (!status || !['verified', 'failed'].includes(String(status).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'status must be verified or failed' });
    }

    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const idx = (candidate.documents || []).findIndex((d) => String(d._id) === documentId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Document not found' });

    candidate.documents[idx].verificationStatus = status.toLowerCase();
    candidate.documents[idx].verifiedAt = new Date();
    candidate.documents[idx].verifiedBy = adminEmail;
    if (notes !== undefined) candidate.documents[idx].notes = String(notes).trim() || undefined;
    await candidate.save();

    const doc = candidate.documents[idx];
    const primarySuperAdmin = getPrimarySuperAdminEmail();
    if (primarySuperAdmin) {
      const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || null;
      sendVerificationNotificationEmail({
        toEmail: primarySuperAdmin,
        adminEmail,
        candidateName: candidateName || undefined,
        candidateEmail: candidate.email || undefined,
        documentLabel: doc.label || doc.category || doc.fileName || 'Document',
        status: doc.verificationStatus,
        notes: doc.notes,
      });
    }

    return res.json({
      success: true,
      data: {
        _id: doc._id,
        verificationStatus: doc.verificationStatus,
        verifiedAt: doc.verifiedAt,
        verifiedBy: doc.verifiedBy,
        notes: doc.notes,
      },
    });
  } catch (err) {
    console.error('[setVerification]', err?.message, err?.stack);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
