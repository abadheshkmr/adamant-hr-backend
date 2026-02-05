import sgMail from '@sendgrid/mail';

function isSendGridConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_MAIL_FROM);
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

/**
 * POST /api/contact
 * Body: { firstName, lastName, email, phone?, company?, message }
 * Sends the "Get in Touch" form submission via SendGrid to CONTACT_US_EMAIL (or PRIMARY_SUPERADMIN_EMAIL).
 */
export async function submitContactForm(req, res) {
  try {
    const { firstName, lastName, email, phone, company, message } = req.body || {};

    const firstNameTrim = (firstName || '').trim();
    const lastNameTrim = (lastName || '').trim();
    const emailTrim = (email || '').trim().toLowerCase();
    const companyTrim = (company || '').trim();
    const messageTrim = (message || '').trim();

    if (!firstNameTrim) {
      return res.status(400).json({ success: false, message: 'First name is required.' });
    }
    if (!lastNameTrim) {
      return res.status(400).json({ success: false, message: 'Last name is required.' });
    }
    if (!emailTrim || !/^\S+@\S+\.\S+$/.test(emailTrim)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    if (!messageTrim) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    if (messageTrim.length > 5000) {
      return res.status(400).json({ success: false, message: 'Message must be at most 5000 characters.' });
    }

    const toEmail =
      process.env.CONTACT_US_EMAIL ||
      process.env.PRIMARY_SUPERADMIN_EMAIL ||
      (process.env.INTERNAL_SUPERADMINS || '').split(',')[0]?.trim();
    if (!toEmail) {
      return res.status(503).json({
        success: false,
        message: 'Contact form is not configured. Please set CONTACT_US_EMAIL in server configuration.',
      });
    }

    if (!isSendGridConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Please try again later.',
      });
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const from = process.env.SENDGRID_MAIL_FROM;
    const fullName = `${firstNameTrim} ${lastNameTrim}`.trim();
    const phoneLine = phone ? `Phone: ${(phone || '').trim()}` : '';

    const text = [
      `New Get in Touch submission from ${fullName}`,
      '',
      `Name: ${fullName}`,
      `Email: ${emailTrim}`,
      phoneLine,
      companyTrim ? `Company: ${companyTrim}` : '',
      '',
      'Message:',
      '---',
      messageTrim,
      '---',
    ].filter(Boolean).join('\n');

    const html = [
      `<p><strong>New Get in Touch submission</strong></p>`,
      `<p><strong>Name:</strong> ${escapeHtml(fullName)}</p>`,
      `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(emailTrim)}">${escapeHtml(emailTrim)}</a></p>`,
      phone ? `<p><strong>Phone:</strong> ${escapeHtml((phone || '').trim())}</p>` : '',
      companyTrim ? `<p><strong>Company:</strong> ${escapeHtml(companyTrim)}</p>` : '',
      '<p><strong>Message:</strong></p>',
      `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(messageTrim)}</pre>`,
    ].filter(Boolean).join('\n');

    await sgMail.send({
      to: toEmail,
      from,
      replyTo: emailTrim,
      subject: `Get in Touch: ${fullName}${companyTrim ? ` (${companyTrim})` : ''}`,
      text,
      html,
    });

    return res.json({ success: true, message: 'Thank you! Your message has been sent. We will get back to you soon.' });
  } catch (err) {
    console.error('[submitContactForm]', err?.message, err?.response?.body);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to send message. Please try again.' });
  }
}

/**
 * POST /api/contact/employer
 * Body: { companyName, contactPerson, email, phone?, jobTitle, industry, ... }
 * Required: companyName, contactPerson, email. Others optional.
 */
export async function submitEmployerForm(req, res) {
  try {
    const body = req.body || {};
    const companyNameTrim = (body.companyName || '').trim();
    const contactPersonTrim = (body.contactPerson || '').trim();
    const emailTrim = (body.email || '').trim().toLowerCase();
    const phoneTrim = (body.phone || '').trim();

    if (!companyNameTrim) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }
    if (!contactPersonTrim) {
      return res.status(400).json({ success: false, message: 'Contact person is required.' });
    }
    if (!emailTrim) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(emailTrim)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (phoneTrim && !/^\+?(\d[\d\s-()]{7,}\d)$/.test(phoneTrim)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });
    }

    const toEmail =
      process.env.CONTACT_US_EMPLOYER_EMAIL ||
      process.env.CONTACT_US_EMAIL ||
      process.env.PRIMARY_SUPERADMIN_EMAIL ||
      (process.env.INTERNAL_SUPERADMINS || '').split(',')[0]?.trim();
    if (!toEmail) {
      return res.status(503).json({
        success: false,
        message: 'Employer form is not configured. Please set CONTACT_US_EMPLOYER_EMAIL in server configuration.',
      });
    }

    if (!isSendGridConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Please try again later.',
      });
    }

    const companyName = companyNameTrim;
    const contactPerson = contactPersonTrim;
    const jobTitle = (body.jobTitle || '').trim();
    const industry = (body.industry || '').trim();
    const companySize = (body.companySize || '').trim();
    const hiringType = (body.hiringType || '').trim();
    const timeline = (body.timeline || '').trim();
    const serviceInterest = (body.serviceInterest || '').trim();
    const location = (body.location || '').trim();
    const numPositions = (body.numPositions || '').trim();
    const hiringNeed = (body.hiringNeed || '').trim();
    const message = (body.message || '').trim();
    const hearAbout = (body.hearAbout || '').trim();
    const preferTimeToCall = (body.preferTimeToCall || '').trim();

    const lines = [];
    if (companyName) lines.push(`Company: ${companyName}`);
    if (contactPerson) lines.push(`Contact: ${contactPerson}`);
    if (emailTrim) lines.push(`Email: ${emailTrim}`);
    if (phoneTrim) lines.push(`Phone: ${phoneTrim}`);
    if (jobTitle) lines.push(`Job Title: ${jobTitle}`);
    if (industry) lines.push(`Industry: ${industry}`);
    if (companySize) lines.push(`Company Size: ${companySize}`);
    if (hiringType) lines.push(`Hiring Type: ${hiringType}`);
    if (timeline) lines.push(`Timeline: ${timeline}`);
    if (serviceInterest) lines.push(`Service Interest: ${serviceInterest}`);
    if (location) lines.push(`Location: ${location}`);
    if (numPositions) lines.push(`Positions: ${numPositions}`);
    if (hearAbout) lines.push(`How heard: ${hearAbout}`);
    if (preferTimeToCall) lines.push(`Prefer time to call: ${preferTimeToCall}`);
    if (hiringNeed) lines.push('', 'Hiring Need:', '---', hiringNeed, '---');
    if (message) lines.push('', 'Message:', '---', message, '---');

    const text = ['New Employer inquiry', '', ...lines].filter(Boolean).join('\n');

    const htmlParts = [];
    if (companyName) htmlParts.push(`<p><strong>Company:</strong> ${escapeHtml(companyName)}</p>`);
    if (contactPerson) htmlParts.push(`<p><strong>Contact:</strong> ${escapeHtml(contactPerson)}</p>`);
    if (emailTrim) htmlParts.push(`<p><strong>Email:</strong> <a href="mailto:${escapeHtml(emailTrim)}">${escapeHtml(emailTrim)}</a></p>`);
    if (phoneTrim) htmlParts.push(`<p><strong>Phone:</strong> ${escapeHtml(phoneTrim)}</p>`);
    if (jobTitle) htmlParts.push(`<p><strong>Job Title:</strong> ${escapeHtml(jobTitle)}</p>`);
    if (industry) htmlParts.push(`<p><strong>Industry:</strong> ${escapeHtml(industry)}</p>`);
    if (companySize) htmlParts.push(`<p><strong>Company Size:</strong> ${escapeHtml(companySize)}</p>`);
    if (hiringType) htmlParts.push(`<p><strong>Hiring Type:</strong> ${escapeHtml(hiringType)}</p>`);
    if (timeline) htmlParts.push(`<p><strong>Timeline:</strong> ${escapeHtml(timeline)}</p>`);
    if (serviceInterest) htmlParts.push(`<p><strong>Service Interest:</strong> ${escapeHtml(serviceInterest)}</p>`);
    if (location) htmlParts.push(`<p><strong>Location:</strong> ${escapeHtml(location)}</p>`);
    if (numPositions) htmlParts.push(`<p><strong>Positions:</strong> ${escapeHtml(numPositions)}</p>`);
    if (hearAbout) htmlParts.push(`<p><strong>How heard:</strong> ${escapeHtml(hearAbout)}</p>`);
    if (preferTimeToCall) htmlParts.push(`<p><strong>Prefer time to call:</strong> ${escapeHtml(preferTimeToCall)}</p>`);
    if (hiringNeed) htmlParts.push('<p><strong>Hiring Need:</strong></p>', `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(hiringNeed)}</pre>`);
    if (message) htmlParts.push('<p><strong>Message:</strong></p>', `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(message)}</pre>`);

    const html = ['<p><strong>New Employer inquiry</strong></p>', ...htmlParts].filter(Boolean).join('\n');

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const from = process.env.SENDGRID_MAIL_FROM;
    const subject = `Employer inquiry: ${companyName || contactPerson || emailTrim || 'New'}`;

    await sgMail.send({
      to: toEmail,
      from,
      replyTo: emailTrim || undefined,
      subject,
      text,
      html,
    });

    return res.json({ success: true, message: 'Thank you! Your inquiry has been sent. We will get back to you soon.' });
  } catch (err) {
    console.error('[submitEmployerForm]', err?.message, err?.response?.body);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to send message. Please try again.' });
  }
}
